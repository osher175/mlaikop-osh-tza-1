# Phase A3 — Frontend Performance Optimization

Date: 2026-08-09
Scope: React/frontend layer only. No DB, RPC, Edge Function, RLS, billing or business-logic changes.

---

## 1. Baseline

Measured with `vite build --mode production` on the pre-A3 tree.

| Artifact | Size | Gzip |
|---|---|---|
| `index-*.js` (initial chunk) | **1,603.85 kB** | **450.77 kB** |
| `xlsx-*.js` (already on-demand, A1) | 429.35 kB | 142.02 kB |
| CSS | 85.28 kB | 14.37 kB |
| Route chunks | 21 chunks (Procurement 42.6 kB, Reports 42.6 kB, AdminSettings 30.4 kB, …) | |

Runtime baseline (Playwright against the dev server):

* Auth status for this environment is `external_unmanaged`, so **no authenticated session can be minted**. Dashboard / Inventory / Reports / Procurement render only their auth shell in automation.
* Therefore: authenticated DOM size, React commit counts, long-task timings and per-route render profiles are `NOT RELIABLY MEASURED`. No numbers were invented for them.
* What *was* reliably measured: route reachability, lazy-chunk loading, console errors, asset request count, and the production bundle graph.

---

## 2. Bottlenecks identified

1. **`@zxing/browser` in the initial bundle.** `EditProductDialog` (rendered by the eager `/inventory` route) statically imported `BarcodeScanner`, which statically imports the ZXing decoder — ~417 kB pulled in for every user on first paint, even though the scanner is only used behind an explicit "scan" button.
2. **`recharts` in the initial bundle.** `Dashboard` is an eager route (correctly — it is the landing screen), and it statically imported `RevenueChart` + `MonthlyPurchasesChart`, the only two recharts consumers on the screen. ~370 kB of charting code blocked first paint.
3. **Duplicate realtime subscription + double invalidation.** `useRealtimeActivity` opened a second channel on `products` invalidating `['recent-activity']`, while `useRealtimeDashboard` already invalidates `recent-activity` on both `products` and `inventory_actions` events. Every product mutation caused two refetches of the same query. The channel names were also not tenant-scoped.
4. **Unconditional `console.log` in the realtime activity path** (shipped to production).

Checked and found **already healthy** (no change made):

* `xlsx` and `jspdf` — already dynamically imported (A1); confirmed in `src/utils/exportInventoryCSV.ts` and `src/components/reports/ExportButtons.tsx`.
* `react-day-picker` / `embla` — only reachable from `src/components/admin/SubscriptionEditor.tsx`, which lives behind a lazy admin route.
* Admin, Procurement, Reports, Suppliers, Settings pages — already lazy (A1).
* `InventoryTable` — already `React.memo`, filtering already hoisted to a single memo in `Inventory.tsx` (A1), procurement lookups already O(1) via `Map`.
* React Query global defaults (`staleTime` 5 min / `gcTime` 10 min) and tenant-scoped query keys — correct; not touched, since inventory/financial correctness outranks request count.
* `useBIAnalytics` is consumed by two charts under one shared query key — deduplicated by React Query already, no duplicate network call.

---

## 3. Files modified

| File | Change |
|---|---|
| `src/components/ui/lazy-barcode-scanner.tsx` **(new)** | `React.lazy` wrapper that mounts the real `BarcodeScanner` only when `open === true`; `Suspense fallback={null}`. |
| `src/pages/AddProduct.tsx` | Swapped the static `BarcodeScanner` import/usage for `LazyBarcodeScanner`. Props identical. |
| `src/components/inventory/EditProductDialog.tsx` | Same swap. This is the import that was dragging ZXing into the initial bundle via the eager `/inventory` route. |
| `src/pages/Dashboard.tsx` | `RevenueChart` and `MonthlyPurchasesChart` converted to `React.lazy` + `Suspense`, with a design-system `Card`+`Skeleton` fallback matching the card footprint. Chart props, data hooks and layout unchanged. |
| `src/hooks/useRealtimeActivity.tsx` | Removed the redundant `products` channel and its duplicate invalidation; tenant-scoped the channel name; `console.log` gated behind `import.meta.env.DEV`. |

No other file was touched. No dependency added, removed or upgraded. No route added, removed or moved. No frozen billing file modified.

---

## 4. Bundle before / after

| | Before | After | Δ |
|---|---|---|---|
| Initial JS (`index-*.js`) | 1,603.85 kB | **794.93 kB** | **−808.92 kB (−50.4%)** |
| Initial JS gzip | 450.77 kB | **233.64 kB** | **−217.13 kB (−48.2%)** |
| CSS | 85.28 kB | 85.30 kB | +0.02 kB |

New on-demand chunks:

| Chunk | Size | Gzip | Loaded when |
|---|---|---|---|
| `barcode-scanner-*.js` | 417.38 kB | 109.22 kB | user opens the scanner dialog |
| `chart-*.js` (recharts core) | 370.82 kB | 102.60 kB | a chart-bearing screen renders |
| `LineChart-*.js` | 11.13 kB | 4.30 kB | Revenue chart |
| `PieChart-*.js` | 26.00 kB | 7.03 kB | (pre-existing) |

Cumulative across A1 + A3: **2.1 MiB → 794.93 kB initial JS**.

### Heavy library loading status

| Library | Before A1 | After A1 | **After A3** |
|---|---|---|---|
| Recharts | INITIAL LOAD | INITIAL LOAD | **ON DEMAND** |
| ZXing | INITIAL LOAD | INITIAL LOAD | **ON DEMAND** |
| XLSX | INITIAL LOAD | ON DEMAND | ON DEMAND |
| jsPDF | INITIAL LOAD | ON DEMAND | ON DEMAND |

---

## 5. Render findings

* Dashboard widgets are independent hook consumers; there is no shared object/array prop being recreated across them, so no memoization was warranted. Nothing was memoized speculatively.
* The two chart cards now suspend independently, so a slow chart chunk no longer delays `SummaryGrid`, `InsightsPanel`, `RecentActivity` or `NotificationPanel` paint.
* `SuppliersChart` and `TopSalesByDimension` are not recharts-based (icon/list rendering); left eager deliberately — lazying them would add a chunk round-trip for no payload benefit.
* Authenticated commit-count profiling: `NOT RELIABLY MEASURED` (no session available in this environment).

---

## 6. Inventory / Products

**Virtualization was NOT implemented — deliberately.**

Reasons:

1. A1 already removed the duplicated filtering pass and debounced search; the list is filtered exactly once per settled keystroke in a single `useMemo` in `Inventory.tsx`.
2. `InventoryTable` is already `React.memo`'d, and images already go through `LazyImage`.
3. The screen renders at the scale of hundreds of rows, and the row content is non-trivial (inline edit, quantity controls, stock-approval dialogs, procurement CTA, three distinct responsive layouts: desktop table, tablet cards, mobile cards).
4. Virtualization would introduce variable-row-height measurement, focus/scroll restoration during inline editing, and screen-reader table-semantics problems — real regression risk against a benefit that measurements do not currently justify.

Per the task's own instruction ("prefer the simpler architecture"), this is deferred, not rejected: if the row count grows past a few thousand, windowing the desktop table only is the recommended next step.

---

## 7. React Query findings

* Query keys already carry the tenant identifier where required — unchanged.
* `useBIAnalytics` is shared by two dashboard cards under one key; React Query dedupes it. No change.
* No inventory / procurement / financial query had its `staleTime` relaxed. Correctness was explicitly preferred over request count.
* Only invalidation change: removal of the duplicate `recent-activity` invalidation path described below.

---

## 8. Realtime findings

| | Before | After |
|---|---|---|
| Channels open on Dashboard | 4 (`dashboard-live-*` ×1 with 2 bindings, `recent-activity-changes`, `products-activity-changes`) | 3 |
| Refetches of `recent-activity` per product event | 2 | 1 |
| Channel name tenant-scoped | `recent-activity-changes` was global | tenant-scoped |
| Production console noise | 2 `console.log` per event | DEV-only |

`useRealtimeDashboard` and `useRealtimeReports` were reviewed and left unchanged — they are already debounced (400 ms) and mount on mutually exclusive routes. No realtime functionality was removed.

---

## 9. Loading experience

* Chart cards now show a `Card` + `Skeleton` fallback of the same footprint, so the dashboard grid does not reflow when charts arrive.
* Scanner uses `fallback={null}` — it is triggered by an explicit user action and the existing dialog handles its own camera-starting state.
* No artificial delay and no fake progress introduced. No visual redesign.

---

## 10. Mobile considerations

The two largest first-load costs on a phone — ZXing and recharts — are now deferred. A mobile user opening `/inventory` no longer parses ~417 kB of camera-decoder JS they may never invoke. The existing responsive card layouts are untouched; no separate mobile architecture was created.

---

## 11. Validation

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit`) | **PASS** (0 errors) |
| ESLint | **108 errors / 14 warnings — baseline unchanged** (no new violations) |
| Production build | **PASS** |
| Route smoke (`/dashboard`, `/inventory`, `/reports`, `/procurement`, `/add-product`, `/settings`, `/admin`) | All resolve; `/admin` correctly redirects to `/auth` for the unauthenticated automation session |
| Console errors during smoke | **0** |
| Chunk-loading errors | **none** |
| Direct URL navigation + refresh on lazy routes | OK |

Authenticated end-to-end verification (Dashboard KPIs, Inventory rows, export downloads, camera scanning) is `NOT RELIABLY MEASURED` in automation for this project — `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` means no session can be injected. Manual verification in the preview is recommended for: opening the barcode scanner from Add Product and from Edit Product, and the Dashboard revenue/purchases charts rendering.

---

## 12. Regression guard

| Item | Status |
|---|---|
| Inventory values | unchanged — no inventory logic touched |
| Financial / analytics formulas | unchanged — no hook computation or RPC touched |
| Tenant isolation | unchanged; realtime channel naming became *more* tenant-scoped |
| Authorization / RLS | unchanged |
| Realtime behavior | preserved (one duplicate refetch removed, same data freshness) |
| Exports (CSV/XLSX/PDF) | untouched, byte-identical output paths |
| QR / barcode scanning | same component, same props, same behavior — only the module load is deferred |
| Routes | unchanged |
| Billing / subscription | untouched; all billing routes remain eager per `CODE_FREEZE_SUBSCRIPTION.md` |

---

## 13. Deferred opportunities

1. **Logo assets:** `mlaiko-logo-horizontal.png` (1.41 MB) and `mlaiko-logo-full.png` (1.44 MB) ship as raw PNGs. Converting to WebP/AVIF would likely be the single largest remaining transfer win — larger than everything A3 achieved — but it touches brand assets and was out of scope.
2. **`xlsx` chunk (429 kB):** could be swapped for a lighter writer, but that is a dependency change (forbidden this phase).
3. **Desktop-table virtualization**, only if row counts grow past a few thousand.
4. **Authenticated render profiling**, once a testable session is available for this project.
5. **`src/pages/OptimizedReports.tsx` and `src/components/dashboard/MonthlyProfitChart.tsx`** appear unrouted/unused; if confirmed dead, deleting them would shrink the module graph. Not removed — removal of functionality is out of scope.
