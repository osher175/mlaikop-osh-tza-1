# Mlaiko — Phase A1: Safe Performance Quick Wins — Results

Date: 2026-08-09
Source audit: `docs/PERFORMANCE_ARCHITECTURE_AUDIT.md` (unchanged, not overwritten)
Scope: Priorities 1–3 only. No schema, RLS, billing, auth or dependency changes.

---

## 1. Files modified

| File | Problem fixed |
|---|---|
| `src/hooks/useNotificationChecker.tsx` | Full `products` table re-fetched every 60s from every authenticated page; notification creation ran as a browser-side N+1 loop (2 reads + 1 write per product). |
| `src/App.tsx` | All ~30 route components eagerly imported — no code splitting. (Soft-frozen file; change approved by the owner, limited to import style + one Suspense boundary.) |
| `src/pages/Inventory.tsx` | Search/stock filtering ran here **and** again in the table; search was un-debounced. |
| `src/components/inventory/InventoryTable.tsx` | Duplicate second filtering pass; `O(n)` array scan per rendered row for procurement requests. |
| `src/utils/exportInventoryCSV.ts` | `xlsx` (~430 kB) statically imported into the initial bundle for an export-only feature. |
| `src/components/inventory/InventoryHeader.tsx` | Adapted to the now-async export helper (`await`). No UI change. |

---

## 2. Priority 1 — Products polling

### Investigation (verified, not assumed)

- **Responsible hook:** `src/hooks/useNotificationChecker.tsx`.
- **Mounted from:** `src/components/notifications/NotificationDropdown.tsx`, which is rendered by the header ⇒ **every authenticated screen**.
- **What it fetched:** `products` (id, name, quantity, expiration_date, business_id) + `product_thresholds` for the **entire** business — no `limit`, no predicate beyond `business_id`.
- **Scoping:** `business_id` filter was already applied and `idx_products_business_id` exists — the cost was call volume, not a missing index.
- **Measured cost (pg_stat_statements):** 12,510 calls · 31.1 ms mean · **389.6 s total** — the #1 query in the database.
- **User-visible dependency on the 60s refresh:** none. The unread badge and dropdown list are fed by a **separate** query (`useNotifications`, 15s staleTime). This hook only *creates* notification rows. Stock-driven notifications are additionally created server-side by the existing `check_product_notifications` trigger and `check_low_stock_notifications()` / `check_expiration_notifications()` functions.

### Change applied

1. Poll interval **60s → 15 min**, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`, `refetchOnMount: false`, `staleTime` = 15 min. Navigating between pages no longer re-triggers the scan.
2. The scan is now **gated**: it only runs when notification settings exist and `low_stock_enabled || expiration_enabled`. Businesses with notifications off issue zero product scans.
3. **N+1 removed.** Candidates are computed locally, then existing notifications are looked up in **one batched query** (chunked `.in()` at 40 ids, per the project's URL-length rule) and missing rows are **bulk inserted** in batches of 40.
4. A `runToken` ref prevents the same dataset being processed twice on re-render.

### Before → After

| | Before | After |
|---|---|---|
| Product scans per open tab | every 60s = **1,440/day** | every 15 min, foreground only = **≤96/day**, and 0 if notifications are disabled |
| Reduction | — | **≈93%** fewer scans (100% for notification-disabled tenants) |
| Full-table polling still exists? | — | Yes, but at 1/15 min. A per-product `low_stock_threshold` lives in a side table, so a server-side "only rows that need alerting" predicate is not expressible in a single PostgREST filter. Moving the whole check server-side is deferred to A2. |
| Notification writes for N candidates | up to `2N` reads + `N` inserts | `ceil(N/40)` reads + `ceil(rows/40)` inserts |
| Behaviour | — | Identical: same messages, same types, same 24h de-duplication window |

Not re-measured live: `pg_stat_statements` totals are cumulative since reset, so a post-change DB total is **NOT RELIABLY MEASURED** in this session. The request-count reduction above is arithmetic from the configured intervals, not an estimate.

---

## 3. Priority 2 — Route-level code splitting

Approved deviation from the soft freeze on `src/App.tsx`: import style only. **No route path, no `ProtectedRoute` allowlist, no `SubscriptionGuard` wrapper, and no route moved in or out of the guard.**

**Eager (unchanged):** `Auth`, `ForgotPassword`, `ResetPassword`, `Unauthorized`, `SmartRedirect`, `MainLayout`, `ProtectedRoute`, `SubscriptionGuard`, `Dashboard`, `Inventory`, and — per the owner's decision — **every billing route** (`Subscribe`, `Subscriptions`).

**Lazy (`React.lazy`):** `Suppliers`, `AddProduct`, `Reports`, `UserProfile`, `UserManagement`, `AdminUserProfile`, `BusinessSettings`, `AdminPanel`, `AdminDashboard`, `AdminSettings`, `StorageManagement`, `Procurement`, `ProcurementDetail`, `WhatsAppSettings`, `SettingsApi`.

A single `<Suspense fallback={<RouteFallback />}>` sits inside the existing `MainLayout` layout route, so the sidebar/header never flash and the fallback is the same centered `Loader2` spinner used elsewhere in the app (RTL preserved).

Additionally, `xlsx` is now loaded with `await import('xlsx')` inside the export helper.

### Bundle: before → after

| | Before | After |
|---|---|---|
| Initial JS chunk | `index-BvLHVbmn.js` — **2.1 MiB** (`du`) | `index-DXAiyXJ_.js` — **1,624,328 B ≈ 1.55 MiB** |
| Reduction in initial JS | — | **≈26%** |
| Lazy chunks generated | 0 | 25 route/vendor chunks |
| Largest lazy chunks | — | `xlsx` 429,804 B · `Reports` 44,608 B · `Procurement` 43,958 B · `AdminSettings` 32,484 B · `PieChart` 26,000 B · `Suppliers` 22,015 B · `StorageManagement` 17,287 B |
| CSS | 84 kB | 84 kB (unchanged) |

Note: the exact **byte** size of the baseline chunk was captured only as `du`-rounded 2.1 MiB in the audit, so the 26% figure carries that rounding. Direction and magnitude are reliable; the third significant digit is **NOT RELIABLY MEASURED**.

The remaining 1.55 MiB is dominated by `recharts` (pulled in by the eagerly-loaded `Dashboard`) and `@zxing` (pulled in by `EditProductDialog` on the eagerly-loaded Inventory page). Both are deferred to A2 — splitting them requires touching component boundaries, not routes.

---

## 4. Priority 3 — Inventory table rendering

### Investigation

`src/pages/Inventory.tsx` computed `filteredProducts` (search + stock status, using a hardcoded threshold of 5) but then passed the **unfiltered** `products` array to `<InventoryTable>`, which performed its **own** two-stage filter (search, then stock status using each product's real `product_thresholds.low_stock_threshold`). So the list was walked 3–4 times per keystroke, on an un-debounced input, and the freshly-built array defeated the `React.memo` on the table.

### Change applied

- **One filtering pass**, in `Inventory.tsx`, inside `useMemo`. The result feeds both the CSV export header and the table.
- The single pass uses the **per-product threshold** — i.e. the predicate the table already used for what it displayed. Displayed rows are therefore byte-identical to before; the CSV export now matches what is on screen (previously it used a hardcoded threshold of 5 and could disagree with the table for products with a custom threshold). This is the one intentional behavioural alignment in A1.
- `InventoryTable` no longer filters; it renders what it receives.
- Search is now debounced 300 ms via the existing `useDebounce` hook (same pattern already used in `OptimizedInventory`). The input stays fully responsive; only the filtering pass is deferred.
- Procurement lookup: `activeProcurementRequests.find(...)` per row replaced by a `useMemo`'d `Map` + `useCallback` accessor — from ~719 array scans per render to one map build.
- The `InventoryStats` counters were deliberately **left untouched** (they still use the hardcoded 5) to avoid changing displayed numbers in A1.

### Before → After

| | Before | After |
|---|---|---|
| Filtering passes per keystroke | 3–4 over ~719 rows, un-debounced | 1 over ~719 rows, debounced 300 ms |
| Procurement request lookup | `O(rows × requests)` per render | `O(requests)` map build, `O(1)` per row |
| Rendered DOM rows | all matching rows | unchanged |
| Virtualization | not used | **still not used** — per instructions, redundant work was removed first. `react-window` is installed and `VirtualizedInventoryTable` exists but is only wired into the unrouted `OptimizedInventory`. Deferred to A2 pending a real measurement. |

Runtime render timing was not instrumented — a frame-level before/after measurement is **NOT RELIABLY MEASURED**.

Preserved and verified in code: search behaviour, all four stock filters, row actions (edit/delete/image/approve/request-quotes), product editing, inventory updates, cost hide/show, mobile & tablet card views, desktop table, RTL layout.

---

## 5. React Query safety review

| Check | Result |
|---|---|
| Query keys tenant-safe | `['products-needing-notifications', businessId]`, `['notification-settings', businessId]`, `['active-procurement-requests', businessId]` — all still keyed by `business_id`. No key was widened or made global. |
| `business_id` in query scope | Every modified query still applies `.eq('business_id', ...)`; the new batched notification lookup **adds** `.eq('business_id', businessId)` (the old per-product probe filtered only by `product_id`) — strictly tighter. |
| Mutation invalidation | Untouched. `useProducts` still invalidates `products` / `recent-activity` / `bi-analytics`; `Inventory.tsx` still calls `refetch()` after edit/delete. |
| Cross-tenant cache collision | Not possible — no unkeyed cache entries introduced. |
| Product mutations visible | Yes — the table now derives from the same `products` query result, so a refetch propagates through the single memo. |
| `staleTime`/`gcTime` overrides | Only `products-needing-notifications` changed (intentionally, 0 → 15 min). Global defaults in `App.tsx` untouched. |

Security-sensitive verdict: **no weakening.** One filter was tightened; nothing was loosened.

---

## 6. Verification results

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit -p tsconfig.app.json`) | **PASS** — 0 errors |
| ESLint (modified files) | 2 pre-existing `no-explicit-any` errors in `exportInventoryCSV.ts` (lines 50–51, supplier-name fallback) — present before A1, untouched. No new lint errors. |
| Production build (`vite build`) | **PASS** — exit 0 |
| Automated tests | No test suite exists in the repo (`e2e/` absent, no vitest specs). Nothing to run. |
| Browser smoke test (Playwright, dev server) | `/inventory`, `/reports`, `/admin`, `/procurement`, `/auth` each loaded by **direct URL navigation** (i.e. lazy chunks resolve on cold entry and on refresh). **0 console errors, 0 page errors.** |

Authenticated end-to-end flows (login, dashboard, product mutation, admin access) could **not** be exercised automatically: `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`, so no session can be minted for this externally-managed Supabase project. Those flows need a manual pass. Unauthenticated routing, guard redirects (`/admin` → `/auth`) and lazy-chunk loading were verified.

---

## 7. Regression safety checklist

| Item | Status |
|---|---|
| Billing behaviour changed | No |
| Subscription behaviour changed | No — no frozen billing file edited. `App.tsx` (soft freeze) changed import style + one Suspense boundary only, with owner approval; billing routes kept eager by explicit request. |
| RLS policy changed | No |
| Tenant isolation changed | No (one filter tightened) |
| Database schema / migrations | None |
| Indexes created or dropped | None |
| Unrelated UI changed | No |
| Feature removed | No — notification generation still runs, just less often and batched |
| New dependency installed | No |
| Dependency upgraded | No |
| Edge functions modified | No |
| Inventory quantities correct | Yes — no mutation path touched |
| Product mutations invalidate UI | Yes — unchanged |
| Realtime still works | Yes — `useRealtimeDashboard` / `useRealtimeActivity` / `useRealtimeReports` untouched |
| Routes unchanged | Yes — identical paths, identical guards, identical allowlists |

---

## 8. Remaining risks

1. **Notification latency.** A newly low-stock or newly expiring product may now surface in the dropdown up to 15 minutes later than before *if* the server-side trigger does not already cover it. Stock-driven cases are covered by `check_product_notifications`; the pure time-based expiration case is the exposed one. Reduce the interval if the owner considers 15 min too slow.
2. **CSV export set changed in one edge case** — export now honours per-product low-stock thresholds instead of a hardcoded 5, matching the table. Intentional; flagged here in case any downstream consumer depended on the old behaviour.
3. **Search feels 300 ms "later"** on very fast typing. Same behaviour as the existing `OptimizedInventory` screen.
4. **Authenticated flows unverified automatically** (see §6). Manual QA recommended before publishing.

---

## 9. Deferred to A2 / A3 / A4

- **A2:** split `recharts` out of the eager Dashboard; lazy-load `@zxing` barcode scanner from `EditProductDialog`; move `useBIAnalytics` and the aggregate half of `useInsights` onto the existing `reports_aggregate` RPC; drop the 30s `recent-activity` poll and the redundant `refetchQueries` in `useRealtimeDashboard`; decide on virtualizing the inventory table with a real measurement.
- **A3:** standardise `staleTime` into three tiers; remove `staleTime: 0` from the four analytics hooks; add the missing `notifications` indexes; drop the duplicate `api_key_usage_log` index.
- **A4:** retention/pruning for `audit_logs`, `user_activity_log`, `recent_activity`, `api_key_usage_log`; paginate and filter the admin `audit_logs` query; mark `require_premium` STABLE; remove the dead `OptimizedInventory` / `OptimizedReports` duplicates.
