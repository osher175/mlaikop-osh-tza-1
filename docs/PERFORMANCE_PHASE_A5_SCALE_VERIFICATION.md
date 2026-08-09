# Mlaiko — Phase A5: Final Scale Verification & Performance Acceptance

Status: **CONDITIONAL PASS**
Date: 2026-08-09
Scope: verification & acceptance only. **No code, DB, billing, RLS or asset changes were made in A5.**

---

## 1. Final Architecture Baseline (post A1–A4)

| Area | Final state | Verified |
|---|---|---|
| Bundle / code splitting | Initial JS `index-*.js` = **791.73 kB (232.78 kB gzip)**. `chart` (370.82 kB), `barcode-scanner` (417.38 kB), `xlsx` (429.35 kB) are lazy chunks. Routes lazy-loaded (Reports, Procurement, Admin*, Settings*, Suppliers…). | ✅ production build |
| React Query | Tenant-scoped query keys (`['products', business_id]`, `['recent-activity', business_id]`, …); polling removed in A1; staleTime/gcTime tuned per hook. | ✅ |
| Realtime | Deduplicated subscriptions (`useRealtimeDashboard`, `useRealtimeReports`, `useRealtimeActivity`) with channel cleanup. | ✅ |
| Inventory rendering | Single filtering pass in `Inventory.tsx`, debounced search, card view on mobile/tablet. **No pagination, no virtualization.** | ⚠️ see §6 |
| Analytics RPCs | All server-side: `reports_aggregate`, `bi_analytics_yearly`, `insights_aggregate`, `supplier_purchases_by_period`, `get_top_sales_by_dimension`, `yoy_financials`. | ✅ |
| Dashboard / Reports / Insights / Supplier analytics | Consume RPCs only; **zero raw `inventory_actions` reads from the browser** (grep: only logger + EditProductDialog write/read-single paths). | ✅ |
| Tenant authorization | All analytics RPCs are `SECURITY DEFINER` + membership guard (`can_access_business_analytics` / `is_business_member` / service_role bypass). | ✅ |
| Free Access Mode | `BILLING_LOCK_ENABLED = false`, `FREE_ACCESS_MODE = true` — intact, untouched. | ✅ |

All A1–A4 optimizations are still present; no regressions detected.

---

## 2. Target-Scale Assessment

Target: 10k products, 100k inventory actions, 100k+ sale items, 20k customers, multi-year history, multi-tenant.

Method: production `pg_stat_user_tables`, `pg_indexes`, function ACL/source inspection, static analysis of every active data hook, production build. No synthetic data inserted.

| Dimension | Verdict |
|---|---|
| Transaction history (100k+ rows) | **Supported** — all aggregation is in Postgres, indexed by `(business_id, timestamp DESC)`. |
| Analytics correctness at scale | **Supported** — no client aggregation, no dependency on the 1,000-row PostgREST limit. |
| Multi-tenant | **Supported** — every predicate and query key is business-scoped. |
| 10,000 products | **NOT safe today** — see P1-1. |

---

## 3. Database Scale Findings

Indexes verified present:

* `inventory_actions`: `(business_id, timestamp DESC)`, `(business_id, action_type, timestamp DESC)`, `(product_id, business_id, timestamp DESC)`, partial `reverses_action_id`, partial `supplier_id`. → analytics scans are range-bounded by date; growth is **per-tenant × date range**, not platform-wide. Good.
* `products`: `(business_id)`, `(business_id, created_at)`, name/location/composite search indexes, `barcode`. Good.
* `recent_activity`: `(business_id, timestamp)`. Good.
* `audit_logs`, `user_activity_log`, `api_key_usage_log`, `stock_alerts`: business/timestamp indexed. Good.
* **`notifications`: primary key only** — no `(business_id, user_id, created_at DESC)` index. → P2-1.
* **`suppliers`: primary key only** (107k seq scans on 15 rows today; harmless now, per-tenant supplier counts stay small). → P3-1.

No sequential scan on a large table is on a hot path. No speculative indexes were created.

---

## 4. Analytics Scale Findings

| RPC | Server-side agg | Bounded payload | Tenant guard | anon/PUBLIC EXECUTE |
|---|---|---|---|---|
| `reports_aggregate` | ✅ | ✅ | ✅ | none |
| `bi_analytics_yearly` | ✅ | ✅ | ✅ | none |
| `insights_aggregate` | ✅ | ✅ | ✅ | none |
| `supplier_purchases_by_period` | ✅ | ✅ (p_limit) | ✅ | none |
| `get_top_sales_by_dimension` | ✅ | ✅ (p_limit) | ✅ | none |
| `yoy_financials` | ✅ | ✅ | ✅ | none |
| `search_products`, `get_product_autocomplete`, `get_expiring_products`, `generate_weekly_stock_summary`, `get_last_sale_at_by_product` | ✅ | ✅ | ✅ | none |

ACL on all of the above: `postgres=X, authenticated=X, service_role=X` — **no `anon`, no PUBLIC EXECUTE**. Caller-supplied `business_id` is validated inside each function. Cron/internal `service_role` paths remain functional.

Reversal exclusion, Asia/Jerusalem boundaries and 18% VAT handling live inside the RPCs, so overlapping paths (Dashboard vs Reports vs Insights vs supplier analytics) reconcile by construction — they read the same canonical SQL rules.

---

## 5. Remaining Raw / Unbounded Client Queries

Primary analytics paths: **none**. Remaining non-analytics list queries:

| Location | Bound | Severity |
|---|---|---|
| `useProducts` — all products for the business, no limit/pagination | unbounded | **P1-1** |
| `useNotificationChecker` — all products + client-side loops | unbounded | **P1-2** |
| `useProcurementRequests` — `statusFilter='all'` has no limit (active filter bounds it) | partly | P2-2 |
| `useStockAlerts` — all unresolved alerts, no limit | partly | P2-3 |
| `useRecentActivity` (15), `useNotifications` (50), `useOptimizedProducts` (limit param), `getSummaryStats` (count-only, `head: true`) | bounded | OK |

None of these performs financial aggregation client-side.

---

## 6. Products / Inventory at 10,000 Products (P1-1)

`Inventory.tsx` → `useProducts()` fetches **every** product row with embedded `product_categories` and `product_thresholds`, then filters, counts and renders client-side.

At 10,000 products this fails on three axes:

1. **Correctness** — PostgREST caps responses at 1,000 rows by default. Counters, filters and CSV export would silently reflect a truncated list.
2. **Payload** — ~10k joined rows per load, repeated on refetch.
3. **DOM** — 10k rows/cards rendered with no virtualization.

Classification: **server-side pagination + server-side search/filter/counters are required before 10k products.** Per A5 boundaries this redesign was **not** implemented — it is the single item gating a full PASS. `useOptimizedProducts` (RPC-backed, limited) and `search_products` already exist and are the natural foundation.

`useNotificationChecker` (P1-2) shares the same unbounded product fetch and should be moved to the existing DB-side notification functions in the same work item.

---

## 7. Transaction History at 100k+ Rows

No application screen requires a full-table download of `inventory_actions`:

* Recent Activity → `recent_activity`, `LIMIT 15`, indexed.
* Reports / Dashboard / Insights → RPC aggregates over indexed date ranges.
* Supplier analytics → `supplier_purchases_by_period` (server-side, limited).

Cost grows with the **requested date range within one tenant**, which is the desired shape. **Supported.**

---

## 8. Multi-Tenant

* Query keys include `business_id` → no cross-tenant cache bleed.
* Every DB predicate filters by `business_id`; RLS enforced on top.
* No aggregate performs a platform-wide scan.
* RLS unchanged in A5.

---

## 9. RLS Performance Assessment

`user_roles` (7 rows, 6.1M seq scans) and `businesses` (6 rows, 1.06M seq scans) show high cumulative counters. These are **counters, not cost**: on tables of ≤10 rows Postgres correctly prefers a single-page seq scan, and the planner will switch to the existing unique indexes (`user_roles_user_business_unique`, `businesses_pkey`) once row counts justify it. `user_businesses` already resolves via index (3.7M idx_scan).

**No RLS rewrite recommended.** Not a scale blocker; re-measure only if per-tenant role rows grow into the thousands.

---

## 10. Security Regression Check

All A2/A4-hardened RPCs re-verified: guard present in source, `anon` absent from ACL, no PUBLIC EXECUTE, caller `business_id` validated, `service_role` retained for cron. **No regressions.** No new findings.

---

## 11. Frontend / Bundle Status

| Chunk | Size | gzip |
|---|---|---|
| initial `index` | 791.73 kB | 232.78 kB |
| `xlsx` (lazy, export only) | 429.35 kB | 142.02 kB |
| `barcode-scanner` / ZXing (lazy) | 417.38 kB | 109.22 kB |
| `chart` / Recharts (lazy) | 370.82 kB | 102.60 kB |
| `Reports` (lazy route) | 42.64 kB | 12.24 kB |
| `Procurement` (lazy route) | 42.61 kB | 11.37 kB |

A3 improvements intact (1,603.85 kB → 791.73 kB, −50.6%). jsPDF is not in the initial graph.

**Mobile at larger datasets:** the card view renders one card per product with no virtualization — the same P1-1 constraint dominates mobile behaviour.

**Branding assets (not modified, recommendation only):** `public/favicon.png` 1.41 MB, `src/assets/mlaiko-logo-full.png` 1.44 MB, `mlaiko-logo-horizontal.png` 1.41 MB, `mlaiko-logo.png` 0.73 MB, plus 2.8 MB in `public/lovable-uploads`. A pixel-identical re-encode (PNG optimisation / correctly sized favicon at 32–512 px) can recover several MB with **zero visual change**. Recommended as a separate approved task.

---

## 12. Findings Register

**P0 — none.**

**P1**
1. `useProducts` unbounded product fetch + unvirtualized rendering → truncation and UI collapse at 10k products (Inventory page and all consumers).
2. `useNotificationChecker` unbounded product fetch with client-side evaluation.

**P2**
1. `notifications` lacks a `(business_id, user_id, created_at DESC)` index.
2. `useProcurementRequests` with `statusFilter='all'` is unlimited.
3. `useStockAlerts` unresolved-alerts query is unlimited.

**P3**
1. `suppliers` has no `business_id` index (harmless at realistic per-tenant volumes).
2. ~5 MB of oversized PNG branding assets.
3. Pre-existing lint baseline: 106 errors / 14 warnings, predominantly `@typescript-eslint/no-explicit-any`. No new violations from A1–A5.

---

## 13. Deferred Work (do not action in A5)

* Dead/legacy analytics code identified in A4 (e.g. `useYearOverYear` and unused chart components) — **retained deliberately**; schedule a separate cleanup task.
* P2/P3 items above.
* Branding asset re-encode (requires explicit approval).

---

## 14. Verification Results

* TypeScript: **pass** (`tsgo --noEmit`, 0 errors).
* Production build: **pass**, 12.72 s.
* ESLint: baseline unchanged (106 errors / 14 warnings, all pre-existing `any` typings).
* Static verification: Dashboard, Inventory, Products, Reports, Suppliers, Procurement, Settings data paths reviewed.
* Authenticated runtime timings at target scale were **not** measured and are not claimed.

---

## 15. Final Verdict

**CONDITIONAL PASS.**

Architecture, analytics correctness, tenant isolation and security all meet the acceptance criteria, and transaction history scales cleanly to 100k+ rows. One known scale limit — the unbounded products query and unvirtualized inventory list (P1-1/P1-2) — must be resolved before operating at 10,000 products.

**Required before target scale:** move the Inventory list to server-side pagination + server-side search/filter/counters (build on `search_products` / `useOptimizedProducts`), and move the notification checker to its existing DB-side equivalents.

Once that single work item ships, Mlaiko meets full PASS and the Performance Optimization Program can be closed.
