# Mlaiko — Phase A2: Database & Query Optimization — Results

Date: 2026-08-09
Status: **A2.1 = analysis only (no SQL executed). A2.2 = two application-side query-shape changes implemented.**
Companion: `docs/PERFORMANCE_PHASE_A2_DB_PROPOSAL.md` (exact SQL, not executed)
Predecessors: `docs/PERFORMANCE_ARCHITECTURE_AUDIT.md`, `docs/PERFORMANCE_PHASE_A1_RESULTS.md`

---

## 1. Database workload after Phase A1

`pg_stat_statements`, ranked by total execution time. The audit column is the value recorded in `PERFORMANCE_ARCHITECTURE_AUDIT.md` earlier today.

| Query | Calls (audit → now) | Δ calls | Mean | Total |
|---|---|---|---|---|
| `products` + `product_thresholds` lateral (notification checker) | 12,510 → **12,512** | **+2** | 31.15 ms | 389.7 s |
| `products` + categories + thresholds, `ORDER BY created_at DESC` (`useProducts`) | 2,356 → **2,358** | **+2** | 77.78 ms | 183.4 s |
| `products` UPDATE by id | 3,012 → **3,012** | 0 | 57.35 ms | 172.7 s |
| `procurement_requests` by business + status | 1,571 → **1,573** | **+2** | 57.15 ms | 89.9 s |
| `inventory_actions` + products + suppliers, `gte`+`lte` (`useBIAnalytics`) | 611 → **611** | 0 | 80.48 ms | 49.2 s |
| `inventory_actions` + products + suppliers, `gte` only (`useInsights`) | 510 → **510** | 0 | 84.09 ms | 42.9 s |
| `products` (second caller, `useOptimizedProducts`) | 3,125 → **3,125** | 0 | 13.66 ms | 42.7 s |
| `inventory_actions` INSERT (logger) | — | — | 9.98 ms | 18.0 s |
| `inventory_actions` open-ended select | — | — | 30.09 ms | 15.1 s |
| **`audit_logs` unfiltered SELECT with exact count** | 40 → **40** | 0 | **341.52 ms** | 13.7 s |
| `products` count-only (`head: true`) | — | 420 | 29.54 ms | 12.4 s |
| `recent_activity` + products, limit 15 (30 s poll) | 3,992 → **3,992** | 0 | 2.77 ms | 11.1 s |

### Did the products poll disappear?

**Cannot be proven from statistics yet, and is not claimed here.** `pg_stat_statements` is cumulative and has not been reset, so the 389.7 s total still carries the pre-A1 history. What the numbers do show is that the notification query grew by **+2 calls** since the audit — the same +2 that every other active query grew by. In other words, almost no traffic has passed through the app in the interval, so the window is too short to demonstrate a reduction.

What can be stated:

- **No regression.** No query's call rate increased after A1.
- The reduction claimed in A1 is arithmetic from the configured interval (60 s → 15 min, foreground-only, settings-gated), not a database measurement.
- **Re-measure properly** by running `SELECT pg_stat_statements_reset();` and comparing after a representative day of use. That is the only way to prove it.

### Table-level scan statistics (`pg_stat_user_tables`)

| Table | Live rows | Seq scans | Seq tuples read | Idx scans | Avg rows/seq scan |
|---|---|---|---|---|---|
| **`user_roles`** | **7** | **6,103,430** | **32,530,199** | 4,204 | 5 |
| **`product_thresholds`** | 666 | 430,012 | 28,392,294 | 8,395,200 | 66 |
| `products` | 719 | 18,472 | 8,336,584 | 1,215,777 | 451 |
| **`businesses`** | **6** | **1,062,162** | 3,211,946 | 918 | 3 |
| `suppliers` | 15 | 107,484 | 1,581,108 | 503,805 | 14 |
| `recent_activity` | 4,297 | 536 | 1,260,043 | 4,243 | 2,350 |
| `procurement_requests` | 586 | 1,644 | 848,921 | 748 | 516 |
| `inventory_actions` | 3,757 | 645 | 674,155 | 68,286 | 1,045 |
| `audit_logs` | 3,569 | 460 | 460,633 | 47 | 1,001 |
| `api_key_usage_log` | 4,932 | 6 | 90 | 9,817 | 15 |

The headline is `user_roles`: a **7-row** table scanned **6.1 million** times. It is the single largest source of row reads in the database. It is not an index problem (the table is one page and already uniquely indexed on `user_id`) — it is an RLS **call-count** problem, analysed in §6.

### Top 5 bottlenecks

1. **`user_roles` / `businesses` re-evaluation inside RLS** — 6.1 M + 1.06 M sequential scans over 6–7 row tables. Highest row-read source in the system.
2. **The notification `products` poll's historical cost** — 389.7 s accumulated. Addressed in A1; **proof pending a stats reset**.
3. **`useProducts`** — 77.8 ms mean × 2,358 calls = 183.4 s. 719 rows with two lateral joins and `products.*`, on every Inventory visit.
4. **`products` UPDATE** — 57.4 ms mean × 3,012 = 172.7 s. Slow for a single-row primary-key update; the cost is triggers (`audit_products_changes`, `log_product_activity`, `check_product_notifications`, `notify_out_of_stock`, `enqueue_low_stock_crossing`) plus index maintenance across 10 indexes on `products`.
5. **`audit_logs` admin read** — 341.5 ms mean, unfiltered, with an exact `count`. Also the highest per-call latency in the system. Note: **no `audit_logs` query exists anywhere in `src/`** — this traffic originates outside the React app (dashboard tooling or an edge function), so it cannot be fixed from the frontend.

---

## 2. Query-shape optimizations implemented (A2.2)

Two changes, both pure column pruning on the two heaviest analytics reads. No filter, no range, no ordering, no row count and no tenant scoping was touched.

### 2.1 `src/hooks/useBIAnalytics.tsx`

Verified unused before removal (grepped every reference in the file): `id`, `notes`, `currency`, `sale_unit_ils`, `list_unit_ils`, `purchase_unit_ils`, and on the embedded product `price`, `cost`, `supplier_id`.

| | Before | After |
|---|---|---|
| Action columns selected | 15 | **9** |
| Embedded `products` columns | 6 (`id, name, price, cost, supplier_id, suppliers(...)`) | **3** (`id, name, suppliers(...)`) |
| Rows returned | unchanged | unchanged |
| Date range | unchanged (financial-year start → year end) | unchanged |
| `business_id` scoping | unchanged | unchanged |

`suppliers!supplier_id(id, name)` still resolves — PostgREST embeds through the foreign key and does not require the FK column in the select list.

### 2.2 `src/hooks/useInsights.ts`

Removed `sale_unit_ils` and `list_unit_ils` (zero references in the file) from both the select and the `InventoryAction` interface, and `price` + `supplier_id` from the embedded product (the separate `products` query on line 115 still supplies `price`, and supplier is read via `action.products.suppliers.name`).

| | Before | After |
|---|---|---|
| Action columns selected | 14 | **12** |
| Embedded `products` columns | 6 | **4** |

### Measured effect

- Rows transferred: **unchanged by design** — this reduces bytes per row, not row count.
- Actual byte reduction: **NOT MEASURED.** Proving it needs a payload capture against a populated tenant, which the current session cannot perform (see §8).
- DB time: unlikely to move much; the 80–84 ms mean is dominated by the lateral joins and RLS, not by column width. The win is transfer and JSON parsing in the browser.

### Considered and deliberately not implemented

| Candidate | Why not |
|---|---|
| `useProducts` `select('*')` → explicit columns | 2nd heaviest query, but `products.*` flows into `Inventory`, `InventoryTable`, `EditProductDialog`, CSV export and the procurement panel. Enumerating the safe column set correctly needs a consumer audit — too broad for "low risk". Recommended for A3. |
| `useSuppliers` / `useNotificationChecker` `select('*')` | 15-row and 1-row tables. No measurable benefit. |
| `audit_logs` admin query | Not present in `src/` — cannot be changed from the app (see §1). |
| Dropping the 30 s `recent_activity` poll | A fetch-frequency/realtime change, not a query shape. Deferred to A3 with the `staleTime` tiering work. |
| Estimated instead of exact count on the `products` count query | Would change a number displayed to the user. Out of scope for "no behaviour change". |

---

## 3. Existing indexes

Complete for the tables in scope:

**`products`** (10 indexes): pkey, `business_id`, `(business_id, created_at)`, `barcode` ×2 (one unique constraint + one plain index — near-duplicate), `product_category_id`, GIN on `name`, GIN on `location`, `(name, quantity, expiration_date, location)`, partial on `(expiration_date, alert_dismissed)`.
**`inventory_actions`** (9): pkey, `business_id`, `(business_id, timestamp DESC)` — 46,934 scans, `(business_id, action_type, timestamp DESC)` — 1,581, `(product_id, business_id, timestamp DESC)` — 5,771, `product_id`, `timestamp` — 13,534, partial on `supplier_id`, partial on `reverses_action_id`.
**`product_thresholds`**: pkey + unique `product_id`.
**`recent_activity`**: pkey, `(business_id, timestamp DESC)`, `user_id`, partial `product_id`.
**`audit_logs`**: pkey, `business_id` (39 scans), `action_type` (0), `timestamp` (0), `user_id` (0).
**`api_key_usage_log`**: pkey, `(api_key_id, created_at DESC)` (9,810) **and an exact duplicate** `idx_api_usage_key_time` (7), `(business_id, created_at DESC)` (0).
**`procurement_requests`**: pkey, `business_id` (31), product/status indexes, `(business_id, approval_status, status)` (0).
**`user_roles`**: pkey, unique `user_id`, unique `(user_id, business_id)`.
**`user_businesses`**: pkey `(user_id)`, `(user_id, business_id)`.
**`notifications`**: **primary key only.**
**`suppliers`, `categories`, `product_categories`, `supplier_invoices`**: **primary key only.**

## 4. Recommended indexes

**Zero SAFE index additions.** Every hot predicate observed in `pg_stat_statements` is already covered, and the tables showing huge sequential-scan counts are 6–719 rows, where a seq scan is the correct plan. Adding indexes there would slow writes for no read benefit.

What is recommended instead (full SQL + rollback in the proposal document):

| Change | Class | Reason |
|---|---|---|
| Guard `reports_aggregate` / `get_top_sales_by_dimension` with a membership check; revoke `anon` execute | **SAFE, security** | Both are `SECURITY DEFINER` with a caller-supplied `business_id`, both executable by `anon`. Cross-tenant read of financial data. |
| `DROP INDEX idx_api_usage_key_time` | SAFE | Exact duplicate; 7 scans vs 9,810 on its twin. |
| `ALTER FUNCTION reports_aggregate / require_premium STABLE` | SAFE | Both are read-only but marked VOLATILE. |
| Wrap `has_role_or_higher(...)` as `(SELECT has_role_or_higher(...))` in RLS policies | CONDITIONAL, security-sensitive | Targets the 6.1 M `user_roles` scans. Touches billing tables — needs `EXPLAIN ANALYZE` proof and a single-table trial first. |
| `notifications` composite indexes | CONDITIONAL | Table has only a pkey, but is currently too small to show cost. Revisit at ~10 k rows. |
| Drop 0-scan indexes on `audit_logs` / `api_key_usage_log` | CONDITIONAL | Zero scans may mean "feature not yet used", not "useless". |
| Log retention via `pg_cron` | CONDITIONAL | Retention windows are a business decision. |

Explicitly rejected (with reasoning) in the proposal: `product_thresholds(product_id)` (already unique-indexed), `suppliers(business_id)`, `businesses(owner_id)`, `user_roles(user_id)`, a "low stock" partial index on `products`, extra `inventory_actions` indexes, and partitioning.

---

## 5. Analytics architecture

Current paths, per metric group:

| Metric group | UI | Hook | Query | Rows to browser | Computed where |
|---|---|---|---|---|---|
| Yearly revenue / COGS / gross+net profit / 12-month buckets / top 5 products / supplier purchase split / discount stats | Dashboard | `useBIAnalytics` (351 lines) | raw `inventory_actions` + products + suppliers, financial-year start → year end | **every action row of the year** | Browser: 12-month loop, per-product map, per-supplier map |
| Low margin, dead stock, stockout risk, product dependency, discount erosion (6 patterns) | Dashboard insights | `useInsights` (587 lines) | raw `inventory_actions` (90 days) **+** `get_last_sale_at_by_product` RPC **+** full `products` list | 90 days of actions + all 719 products | Browser |
| Year-over-year comparison | Reports | `useYearOverYear` (245 lines) | raw `inventory_actions`, 2 years, 9 columns | **two years of action rows** | Browser |
| Monthly supplier ranking | Dashboard | `SuppliersChart` | raw `inventory_actions` for the current month + products + suppliers | one month of `add` rows | Browser |
| Report KPIs, timeline, top products, purchases | Reports | `useReportsData` → **`reports_aggregate` RPC** | one aggregate call | **one JSON object** | **Server** ✅ |
| Top sales by product/category/brand/supplier | Reports | `useSalesByDimension` → **`get_top_sales_by_dimension` RPC** | one aggregate call | **small array** ✅ | **Server** ✅ |
| Dashboard report figures | Dashboard | `useDashboardReportsData` → `reports_aggregate` | one aggregate call | small ✅ | **Server** ✅ |

So the codebase already runs **two architectures side by side**. Reports is server-aggregated and correct. The Dashboard predates it and still ships raw rows to the browser.

**Biggest scalability problem: `useYearOverYear`.** It downloads *two full years* of `inventory_actions` in one request. At the stated target of 100,000 actions this is the first hook that will break — and it will break hard, because PostgREST caps responses at **1,000 rows by default**, so it will not merely be slow, it will silently return truncated data and produce **wrong financial figures**. `useBIAnalytics` (one year) hits the same 1,000-row ceiling shortly after. Today there are 3,757 total actions, so the ceiling has probably already been crossed for the full-history queries — this deserves verification before anything else in A3.

Target paths (not implemented):

```
useBIAnalytics:   UI → reports_aggregate(business_id, yearStart, yearEnd)     → 1 JSON object
useYearOverYear:  UI → reports_aggregate ×2 (this year, last year)            → 2 JSON objects
useInsights:      UI → new RPC returning per-product margin/last-sale/velocity → ~1 row per product
SuppliersChart:   UI → get_top_sales_by_dimension(..., 'supplier')            → ≤10 rows
```

`reports_aggregate` already returns `timeline_breakdown`, `purchases_breakdown` (monthly) and `top_products_list` — the exact shapes `useBIAnalytics` builds by hand.

---

## 6. `reports_aggregate` assessment

| Question | Finding |
|---|---|
| Exists? | Yes — `plpgsql`, `SECURITY DEFINER`, `SET search_path = public`. |
| What it returns | `total_added`, `total_removed`, `total_value`, `gross_profit`, `net_profit`, `top_product`, `suppliers_breakdown`, `timeline_breakdown` (daily), `top_products_list` (top 20), `purchases_breakdown` (monthly). |
| Current and correct? | Yes. It filters `is_reversal = false AND reversed_at IS NULL`, so it already honours the undo feature added earlier. It applies the 18% VAT rule (`revenue_net := revenue_gross / 1.18`) consistently with `formatCurrency`/`financialConfig`. It treats both `remove` and `sale` as sales, matching the documented rule. |
| Respects `business_id`? | It **filters** by `business_id` on every sub-query — but as `SECURITY DEFINER` it does **not verify the caller belongs to that business**, and `anon` holds EXECUTE. **This is a cross-tenant exposure, not a performance issue.** See proposal §S1. |
| Branch-level isolation? | **Not applicable — the schema has no branch/`branch_id` concept.** `businesses` is the only tenancy level. If multi-branch inventory (listed as a future idea in the project brief) is ever built, this function and every `business_id` index would need a matching `branch_id` dimension. |
| How is it refreshed? | It is **not** a cached object — it is a function computed on every call against live `inventory_actions`. There is nothing to refresh and no staleness. |
| Would using it create stale reporting? | **No.** This is its main advantage over a materialized view. |
| Covers existing dashboard KPIs? | Mostly. Directly covered: revenue, COGS-derived gross/net profit, monthly purchases, daily sales timeline, top products, supplier purchase volume. **Not covered:** the discount metrics (`totalDiscounts`, `avgDiscountPercent`), the per-product *net* profit split that `useBIAnalytics` computes, and every `useInsights` pattern (dead stock, stockout risk, dependency, margin). Those need either extra keys in the function or a second RPC. |
| Volatility | Marked **VOLATILE** though it only reads. Should be STABLE (proposal §S3). |

**Recommendation: RPC aggregation (extend `reports_aggregate`) — a hybrid, in two steps.**

1. Add the missing keys (`total_discounts`, `avg_discount_percent`, per-product net profit) to `reports_aggregate`, then point `useBIAnalytics`, `useYearOverYear` and `SuppliersChart` at it.
2. Add a **separate** insights RPC for the per-product operational metrics (`useInsights`), rather than overloading the reporting function.

Trade-offs weighed:

| Option | Verdict |
|---|---|
| Keep current queries | Rejected — the 1,000-row PostgREST cap makes the raw-row hooks a correctness risk, not just a speed one. |
| Regular view | Rejected — a view cannot take `date_from`/`date_to` parameters, so every caller would filter after the fact and lose the aggregation benefit. |
| **RPC aggregation** | **Recommended** — already proven in this codebase, always live, parameterised, one round trip, no refresh machinery. Cost: aggregation runs on every call (mitigated by the existing `(business_id, timestamp DESC)` index) and logic lives in SQL rather than TypeScript. |
| Materialized view | Rejected — introduces staleness into figures the UI presents as live, needs a refresh schedule, and needs a security-barrier wrapper for RLS. Revisit only if a single RPC call ever exceeds ~500 ms. |
| Maintained aggregate table | Rejected — trigger-maintained rollups must be kept correct through the reversal/undo flow. Highest complexity and the highest chance of silently wrong money. |

---

## 7. Tenant resolution — SECURITY-SENSITIVE

**Application side: no measurable overhead, no change made.**

`useBusinessAccess` is used in 37 files but is a single React Query entry keyed `['business-context', user.id]`, inheriting the global 5-minute `staleTime`. All 37 consumers share one cached result — the `get_user_business_context` RPC runs roughly once per session, not once per component. There is nothing to deduplicate. `useBusinessAccess.tsx` also carries the `CODE FREEZE` header, so it was not touched.

**Database side: this is where the cost is.**

- `get_user_business_context`, `is_business_member`, `get_user_role`, `has_role_or_higher`, `can_business_write`, `business_billing_status` are all correctly `STABLE SECURITY DEFINER` with `SET search_path = public`.
- Despite that, `user_roles` (7 rows) shows **6,103,430** sequential scans and `businesses` (6 rows) **1,062,162**, at ~5 and ~3 rows read per scan. That ratio is what per-row evaluation of an RLS predicate looks like, not one InitPlan per statement.
- The predicate involved appears on `audit_logs`, `notifications`, `notification_settings`, `api_keys`, `api_key_usage_log`, `billing_events`, `payment_sessions`:
  `has_role_or_higher('admin') OR (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))`
- `is_business_member` additionally carries a **documented temporary fallback** (`OR EXISTS (SELECT 1 FROM businesses WHERE id = _business_id AND owner_id = _user_id)`) marked "Remove after full backfill of owners into `user_businesses`". That fallback doubles the work on the hottest RLS path and should be retired once the backfill is confirmed.

**Verdict: yes, tenant resolution creates measurable overhead — the largest row-read volume in the database — but the fix is an RLS rewrite (proposal §C1), which is out of A2's execution scope.** No RLS was changed, no tenant authorization was cached client-side, and nothing was allowed to bypass RLS.

---

## 8. Pagination & large-data strategy (recommendations only)

Against the stated targets (10 k products, 100 k inventory actions, 100 k+ sale items, 20 k customers, multi-year history):

| Screen | Today | Breaks at | Recommended |
|---|---|---|---|
| **Inventory** | all 719 rows + 2 laterals, filter in JS (single pass after A1), no virtualization | **1,000 rows — the PostgREST default cap. Silent truncation, not an error.** | Server-side pagination (`range()`) + server-side search via the existing `search_products` RPC + server-side stock/category filters. Highest priority. |
| **Reports** | `reports_aggregate` RPC | comfortable | Keep. Enforce a maximum date span in the UI. |
| **Dashboard BI** | full financial year of raw actions | **1,000 actions** | Move to `reports_aggregate` (§5). |
| **Year-over-year** | **two full years** of raw actions | **1,000 actions — likely already exceeded** | Two `reports_aggregate` calls. Verify current correctness first. |
| **Insights** | 90 days of actions + all products | 1,000 of either | Dedicated per-product aggregate RPC. |
| **Procurement** | all non-closed requests per business | ~1,000 open requests | Server-side status filter + pagination + `updated_at` cursor. |
| **Suppliers** | `select('*')`, 15 rows | ~1,000 | Pagination + server-side name search when it approaches that. |
| **Recent activity** | `limit 15`, indexed | fine | Keep; switch the 30 s poll off in favour of the existing realtime channel. |
| **Admin audit logs** | unfiltered + exact count, 341 ms | already slow | Date filter + `range()` + drop the exact count. **Caller is outside `src/`** — locate it first. |
| **Customers** | **no `customers` table exists in the schema** | — | N/A today. If added, index `(business_id, created_at DESC)` and paginate from day one. |

The 1,000-row PostgREST cap is the recurring theme and the single most important item in this section: it degrades into **wrong numbers**, not visible errors.

---

## 9. Verification

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit -p tsconfig.app.json`) | **PASS** — 0 errors |
| ESLint (both modified files) | 3 pre-existing `no-explicit-any` in `useBIAnalytics.tsx` (`action.products as any`, lines 180/224/269). **No new errors.** |
| Production build | **PASS** — exit 0; initial chunk 1,624,102 B (vs 1,624,328 B after A1 — unchanged, as expected) |
| Tests | No test suite exists in the repo |
| Browser smoke (Playwright, direct URL) | `/inventory`, `/reports`, `/admin`, `/procurement`, `/auth` — all load, `/admin` correctly redirects to `/auth`, **0 console errors, 0 page errors** |
| Dashboard / Products / Suppliers authenticated screens | **Not verified automatically** — `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`, so no session can be minted against this externally-managed Supabase project. Manual pass required. |

## 10. Remaining risks

1. **The A1 poll reduction is still unproven at the database level.** Run `SELECT pg_stat_statements_reset();` and re-measure after a normal day of use.
2. **Cross-tenant exposure in `reports_aggregate` and `get_top_sales_by_dimension`** — `SECURITY DEFINER`, caller-supplied `business_id`, `anon` holds EXECUTE. Unfixed (migration not permitted in A2). Should be the first thing approved.
3. **PostgREST 1,000-row cap** may already be truncating `useYearOverYear` and `useBIAnalytics`, producing understated financial figures. Needs verification against a tenant with more than 1,000 actions in range.
4. The two pruned analytics queries were verified by static analysis and typecheck, not by observing the rendered Dashboard with real data. Manual verification of the dashboard charts is recommended.
5. `is_business_member`'s temporary owner fallback is still in place on the hottest RLS path.

## 11. Confirmation of constraints

No migration was executed. No index created or dropped. No RLS policy, grant, function, view or schema object changed. No billing or subscription behaviour touched, no hard-frozen file modified (`useBusinessAccess.tsx` was read only), no payment flow altered. No dependency installed or upgraded. No UI redesigned. No import module built. No analytics migration performed.

Files changed in A2: `src/hooks/useBIAnalytics.tsx`, `src/hooks/useInsights.ts` — column pruning only.
