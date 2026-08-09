# Mlaiko — Phase A: Performance & Architecture Audit

Status: **read-only audit. No code, schema, RLS, UI or business-logic changes were made.**
Date: 2026-08-09
Scope: frontend rendering, data fetching, database/query patterns, RLS, dashboard & analytics, large lists, React Query strategy, realtime, bundle, edge functions.

---

## 0. Executive summary

The application is functionally rich but carries a small number of **structural** performance problems that dominate everything else. Ranked by measured impact:

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | A 60-second poll re-downloads the **entire product table** for every open tab | 12,510 calls, 389.6s total DB time — the single most expensive query in the system | Critical |
| 2 | No route-level code splitting — one **2.1 MB** JS bundle | `dist/assets/index-*.js` = 2.1 MB (single chunk) | Critical |
| 3 | Inventory page loads **all 719 products** with joins, then filters in JS (twice) | `useProducts` + `Inventory.tsx` + `InventoryTable.tsx` | High |
| 4 | Dashboard analytics pull a **full year** of `inventory_actions` and aggregate client-side | `useBIAnalytics.tsx` (351 lines), `staleTime: 0` | High |
| 5 | Polling and realtime **overlap** — the same data is refreshed by both | `useRecentActivity` (30s) + `useRealtimeDashboard`/`useRealtimeActivity` | Medium |
| 6 | Client-side notification engine writes to the DB from the browser in an N+1 loop | `useNotificationChecker.tsx` | Medium |
| 7 | Unbounded log tables queried without filters | `audit_logs` full scan: 40 calls, mean **341 ms** | Medium |
| 8 | React Query cache policy is inconsistent (`staleTime` ranges 0 → 10 min with no rule) | 20+ hooks | Medium |

Nothing here requires a rewrite. Items 1–3 alone would remove an estimated **~70% of total database time** and roughly **60–70% of initial JS payload**.

---

## 1. Data fetching & database load (measured)

Source: `pg_stat_statements`, ranked by total execution time.

| Query | Calls | Mean | Total | Origin |
|---|---|---|---|---|
| `products` + `product_thresholds` lateral, filtered by `business_id` | **12,510** | 31.1 ms | **389.6 s** | `useNotificationChecker` (`refetchInterval: 60000`) |
| `products` + categories + thresholds, ordered by `created_at` | 2,356 | 77.8 ms | 183.2 s | `useProducts` (Inventory page) |
| `products` UPDATE by id | 3,012 | 57.4 ms | 172.7 s | Edit/quantity mutations |
| `procurement_requests` by business, status filter | 1,571 | 57.2 ms | 89.8 s | `InventoryTable` — one query per table render |
| `inventory_actions` + products + suppliers, date-ranged | 611 | 80.5 ms | 49.2 s | Reports / BI |
| `inventory_actions` + products + suppliers, open-ended | 510 | 84.1 ms | 42.9 s | `useBIAnalytics` |
| `products` (same shape as #2, second caller) | 3,125 | 13.7 ms | 42.7 s | `useOptimizedProducts` |
| **`audit_logs` unfiltered SELECT with count** | 40 | **341.5 ms** | 13.7 s | Admin panel |
| `recent_activity` + products, limit 15 | 3,992 | 2.8 ms | 11.1 s | `useRecentActivity` (30s poll) |

### 1.1 The notification poller (highest single cost)

`src/hooks/useNotificationChecker.tsx` is mounted inside `NotificationDropdown`, which lives in the header — i.e. **on every authenticated page**. It:

- fetches every product of the business every 60 s (`refetchInterval: 60000`), with no `staleTime`, no column pruning beyond 5 fields, no server-side filter for "actually needs a notification";
- then, in a `useEffect`, loops over **all** products and issues **two additional round trips per product** (existence check + insert) for low-stock and expiration candidates.

At 719 products this is a client-driven N+1 write loop that also duplicates logic already present server-side in `check_low_stock_notifications()`, `check_expiration_notifications()` and the `check_product_notifications` trigger.

**Recommendation (not applied):** delete the client-side generation loop and let the existing DB functions/trigger own it; if a client poll must remain, filter server-side (`quantity <= threshold OR expiration_date <= ...`) and raise the interval to 5–10 minutes with `refetchIntervalInBackground: false`.

### 1.2 Duplicate product fetchers

Three hooks fetch the same table with near-identical shapes:

- `src/hooks/useProducts.tsx` — all products + `product_categories` + `product_thresholds`, `staleTime` 2 min. Used by `Inventory.tsx`.
- `src/hooks/useOptimizedProducts.tsx` — same joins with `ilike` OR-search, limit 100, `staleTime` 2 min. Used by `OptimizedInventory.tsx`.
- `useNotificationChecker` — subset of columns, 60 s poll.

`Inventory.tsx` and `OptimizedInventory.tsx` are two parallel implementations of the same screen; only `Inventory` is routed. The dead-but-compiled `OptimizedInventory` still ships in the bundle.

### 1.3 Triple filtering of the same array

In `src/pages/Inventory.tsx` the product list is filtered by search + stock status (lines 37–60), and the resulting array is passed to `InventoryTable`, which **filters it again** by the same search term and stock status (lines ~96–110). Both filters run on every keystroke over 719 rows and produce new array identities, defeating the `React.memo` on the table.

### 1.4 Per-render procurement query

`InventoryTable` issues its own `procurement_requests` query (1,571 calls, 57 ms mean, 89.8 s total) and then does a linear `.find()` per row inside render. A `Map` built once in `useMemo`, plus lifting the query, would remove ~719 array scans per render.

---

## 2. Indexes & RLS

### 2.1 Indexes — largely adequate

`products` has `business_id`, `(business_id, created_at)`, barcode, name/location search and a composite search index. `inventory_actions` has `(business_id, timestamp DESC)`, `(business_id, action_type, timestamp DESC)` and `(product_id, business_id, timestamp DESC)`. `recent_activity` has `(business_id, timestamp)`. `procurement_requests` has business/product/status indexes.

The slow queries are therefore **not** missing-index problems — they are **call-volume and payload-size** problems. Adding indexes will not help; reducing calls will.

Two observations worth noting:

- `notifications` has **only** a primary key — no index on `(business_id, user_id, is_read, created_at)` or on `product_id`. The notification-checker's per-product existence probe (`product_id` + `type` + `created_at`) therefore has no supporting index. If the client loop stays, this is a real gap.
- `api_key_usage_log` carries three overlapping indexes (`idx_api_key_usage_log_key_created`, `idx_api_usage_key_time` are duplicates on `(api_key_id, created_at DESC)`), costing write throughput on the hottest-growing table (4,932 rows).

### 2.2 RLS — correct and cheap

Policies on `products`, `inventory_actions`, `recent_activity` all reduce to `is_business_member(business_id)`. The helper functions are declared **STABLE** and `SECURITY DEFINER`:

| Function | Volatility |
|---|---|
| `is_business_member` | STABLE |
| `can_business_write` | STABLE |
| `business_billing_status` | STABLE |
| `has_role_or_higher` | STABLE |
| `require_premium` | **VOLATILE** |

STABLE means Postgres can cache the result per statement rather than per row — this is the correct configuration and RLS is not a measurable cost here. The one exception, `require_premium`, is VOLATILE; it is not used in a row-level policy today, but if it ever were, it would be evaluated **per row**. Worth marking STABLE defensively.

Multi-tenant isolation is consistent: every audited policy is scoped by `business_id`. No cross-tenant leak found in the audited tables.

### 2.3 Unbounded log reads

`audit_logs` is selected with no `WHERE` and with an exact count (`total_result_set`), at 341 ms mean over 3,569 rows. The count is the expensive part. `cleanup_old_audit_logs()` exists but there is no evidence of a schedule enforcing retention on `audit_logs`, `user_activity_log`, `recent_activity` (4,297 rows) or `api_key_usage_log` (4,932 rows).

---

## 3. Dashboard & analytics

`src/hooks/useBIAnalytics.tsx` (351 lines) fetches an open-ended range of `inventory_actions` joined to products and suppliers, then aggregates revenue, cost, profit, per-month buckets and supplier rankings **in a JavaScript loop**. It runs with `staleTime: 0` and `refetchOnWindowFocus: true`, so every tab focus re-downloads and re-aggregates the full dataset (measured: 84 ms mean at the DB alone, before transfer and parsing).

`src/hooks/useInsights.ts` (587 lines) independently fetches 90 days of `inventory_actions`, calls `get_last_sale_at_by_product`, and fetches the full product list — a third full-table read on the same dashboard paint.

Meanwhile the project already has the right primitive: `reports_aggregate()` and `get_top_sales_by_dimension()` do this work server-side and are used by `useReportsData` / `useSalesByDimension`. The dashboard path simply predates them.

**Recommendation (not applied):** route `useBIAnalytics` and the aggregate portions of `useInsights` through `reports_aggregate`, returning pre-bucketed rows instead of raw action rows. This is the largest single reduction in transferred bytes available.

---

## 4. React Query strategy

Global default in `src/App.tsx`: `staleTime` 5 min, `gcTime` 10 min. Twenty-plus hooks then override it, with no discernible rule:

| Band | Hooks |
|---|---|
| `staleTime: 0` + focus refetch | `useBIAnalytics`, `useReportsData`, `useSalesByDimension`, `useBusinessInsights` |
| 15 s | `getSummaryStats`, `useNotifications` |
| 30 s poll | `useRecentActivity` |
| 60 s poll | `useNotificationChecker` |
| 2 min | `useProducts`, `useOptimizedProducts` |
| 5 min | suppliers, categories, notification settings, reports |
| 10 min | `getRevenueHistory`, `useYearOverYear` |

The `staleTime: 0` + `refetchOnWindowFocus: true` combination on the four heaviest analytics hooks means **alt-tabbing back into the app triggers a full analytics re-fetch**. Given that realtime invalidation already exists (section 5), the freshness gained is redundant.

A three-tier convention would remove the ambiguity: reference data 10 min / operational data 60 s / realtime-backed data 5 min with invalidation only.

---

## 5. Realtime — overlapping with polling

Three realtime subscriptions exist and are correctly written (subscribed inside `useEffect`, cleaned up with `removeChannel`, filtered by `business_id`, debounced):

- `useRealtimeDashboard` — `Dashboard.tsx`; listens to `inventory_actions` + `products`, invalidates **and force-refetches** 8 query keys with a 400 ms debounce.
- `useRealtimeActivity` — `RecentActivity.tsx`.
- `useRealtimeReports` — `Reports.tsx`.

The problem is duplication, not correctness:

- `recent-activity` is refreshed by a 30 s poll **and** by `useRealtimeDashboard` **and** by `useRealtimeActivity`.
- `useRealtimeDashboard` calls `invalidateQueries` followed by `refetchQueries({type:'active'})` — the invalidate alone already refetches active queries, so each event costs two passes over 8 keys.
- Because those keys include `bi-analytics-real`, a single stock change triggers a full-year analytics re-download.

**Recommendation (not applied):** with realtime in place, drop the 30 s / 60 s polls entirely and remove the redundant `refetchQueries` call.

---

## 6. Rendering & large lists

- **719 products render as 719 DOM rows.** `react-window` and `@types/react-window` are installed and `VirtualizedInventoryTable` exists, but the routed page (`Inventory.tsx`) uses the non-virtualized `InventoryTable`. Virtualization is available and unused on the one screen that needs it.
- `InventoryTable` is `React.memo`'d, but every parent render passes a freshly-built `filteredProducts` array and inline arrow callbacks (`guard(setEditingProduct)` etc.), so the memo never hits.
- `getStatusBadge`, `isLowStock`, `getCategoryName` and `getActiveRequestId` are recreated per render and executed per row.
- Search is debounced (300 ms) in `OptimizedInventory` but **not** in the routed `Inventory.tsx` — every keystroke re-filters 719 rows twice and re-renders the full table.
- `LazyImage` is used for product images — good.

---

## 7. Bundle & code splitting

- Production build: **one 2.1 MB JS chunk**, Vite emits the >500 kB warning. No `React.lazy` anywhere in `src/App.tsx`; all 30+ routes — Admin panel, Procurement, Reports, Storage Management, WhatsApp settings, Subscribe — are eagerly imported.
- Heavy libraries pulled into the initial chunk regardless of route: `recharts` (Reports/Dashboard only), `xlsx` (export only), `jspdf` (export only), `@zxing/browser` + `@zxing/library` (barcode scanner only), `embla-carousel-react`, `react-day-picker`.
- 58 runtime dependencies, including 29 separate Radix packages.
- Both `Inventory` and the unused `OptimizedInventory`, and both `Reports` and `OptimizedReports`, are compiled in.

Route-level `React.lazy` plus dynamic `import()` for `xlsx`/`jspdf`/`@zxing` at the point of use is the highest-leverage frontend change available and touches no business logic.

---

## 8. Edge functions

23 edge functions. Observations, no changes made:

- **Cold-start weight:** several functions (`retail-iq-api`, `public-api`, `procurement-*`) each construct their own Supabase client and duplicate CORS/auth/rate-limit helpers rather than importing from `_shared/`. `_shared/billing.ts` exists and is the right pattern to extend.
- **Rate limiting** is DB-backed (correct for multi-isolate), but each API request writes a row to `api_key_usage_log` **and** reads it back for the window count. At 4,932 rows and growing with no retention policy, this read cost grows linearly. A `(api_key_id, created_at DESC)` index exists (twice), so the query is fine today; the missing piece is pruning.
- **Cron functions** (`check-expiring-products`, `generate-weekly-stock-summary`) iterate businesses sequentially with a per-business billing check. Fine at current tenant count; will need batching past a few hundred businesses.
- **Batching constraint** (`.in()` chunks of 40) is respected where present.
- No N+1 patterns found inside the procurement functions.

---

## 9. Prioritized recommendations (for a future Phase B — nothing applied)

**Tier 1 — highest impact, lowest risk**

1. Remove or server-side-filter the 60 s product poll in `useNotificationChecker`, and delete the browser-side notification-writing loop in favour of the existing DB functions. (≈50% of total DB time.)
2. Add route-level `React.lazy` in `App.tsx` and dynamic-import `xlsx` / `jspdf` / `@zxing`. (≈60–70% smaller initial bundle.)
3. Switch the routed Inventory page to the virtualized table, and remove the duplicate filtering pass inside `InventoryTable`.

**Tier 2**

4. Move `useBIAnalytics` and the aggregate parts of `useInsights` onto `reports_aggregate`.
5. Drop the 30 s `recent-activity` poll and the redundant `refetchQueries` in `useRealtimeDashboard`; rely on invalidation.
6. Establish the three-tier `staleTime` convention and remove `staleTime: 0` from analytics hooks.

**Tier 3**

7. Add a `notifications (business_id, user_id, is_read, created_at DESC)` index and a `notifications (product_id, type, created_at DESC)` index if the client checker stays.
8. Drop the duplicate `api_key_usage_log` index; schedule retention for `audit_logs`, `user_activity_log`, `recent_activity`, `api_key_usage_log`.
9. Filter and paginate the admin `audit_logs` query; drop the exact count.
10. Mark `require_premium` STABLE.
11. Delete or route the dead `OptimizedInventory` / `OptimizedReports` duplicates.

---

## 10. Constraints respected

- No source file, migration, RLS policy, edge function or UI element was modified.
- The subscription/billing code freeze (`CODE_FREEZE_SUBSCRIPTION.md`) was not touched; no recommendation above requires editing a frozen file, with the single exception of `App.tsx` route lazy-loading, which would need the standard 4-step freeze review before implementation.
