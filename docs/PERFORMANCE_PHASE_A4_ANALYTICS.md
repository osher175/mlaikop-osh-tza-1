# Phase A4 — Analytics Performance & Architecture Consolidation

Status: **Completed**
Scope: analytics/reporting surface only. No billing, subscription, auth-guard or
Free-Access-Mode file was touched (see `CODE_FREEZE_SUBSCRIPTION.md`).

---

## 1. Analytics surface inventory

### Active (server-side aggregated, canonical)

| Consumer | Hook | Server function | Scale-safe |
|---|---|---|---|
| Dashboard BI cards/charts | `useBIAnalytics` | `bi_analytics_yearly` | yes |
| Dashboard supplier ranking | inline query in `SuppliersChart` | `supplier_purchases_by_period` (**new, A4**) | yes |
| Dashboard monthly purchases | `MonthlyPurchasesChart` | `bi_analytics_yearly` | yes |
| Reports page (all widgets) | `useReportsData` | `reports_aggregate` | yes |
| Reports insights | `useInsights` / `useBusinessInsights` | `insights_aggregate` | yes |
| Sales by dimension | `useSalesByDimension` | `get_top_sales_by_dimension` | yes |
| Dead-stock / last sale | — | `get_last_sale_at_by_product` | yes |
| Summary tiles | `getSummaryStats` | `count: exact, head: true` | yes |

### Dead / legacy (no importers — left in place, not deleted)

| File | Reason |
|---|---|
| `src/hooks/useYearOverYear.ts` | no consumers |
| `src/components/dashboard/TopProductsChart.tsx` | not rendered by `Dashboard.tsx` |
| `src/hooks/useDashboardReportsData.ts` | only consumed by the dead `TopProductsChart` |
| `src/pages/OptimizedReports.tsx` + `src/hooks/useOptimizedReports.tsx` | page is not registered in the router |
| `mlaikop-osh-tza-1-main/**` | legacy snapshot copy of the project, not built |

These are documented rather than removed, per the project's "do not delete
pages/files without an explicit instruction" rule. Removing them is a safe,
separate follow-up if requested.

---

## 2. Correctness / scale fix — supplier ranking

`SuppliersChart.tsx` was the last analytics widget issuing a **raw PostgREST
query** against `inventory_actions` with a nested product/supplier join and
client-side grouping.

Problems:

- **Row truncation** — PostgREST caps responses at 1,000 rows. With 1,315
  purchase rows already recorded for the main tenant, a busy month would have
  silently produced an incomplete and therefore wrong ranking.
- **Reversals counted** — the query did not exclude `is_reversal = true` or
  `reversed_at IS NOT NULL`, so cancelled purchases inflated supplier volume.
  Every other financial surface excludes them.
- **Payload weight** — one row per action plus a joined product/supplier object
  transferred to the browser just to produce ≤ 50 aggregated rows.

Fix: new `public.supplier_purchases_by_period(p_business_id, p_date_from,
p_date_to, p_limit)`.

- Applies the **canonical purchase rule** used by `bi_analytics_yearly`:
  `action_type IN ('add','purchase')` and `is_reversal = false AND reversed_at IS NULL`.
- Cost per row: `purchase_total_ils`, falling back to
  `abs(quantity_changed) * coalesce(purchase_unit_ils, products.cost, 0)` —
  identical to the previous client-side formula.
- Supplier resolution: `inventory_actions.supplier_id` with fallback to
  `products.supplier_id` — identical to before.
- Returns a bounded JSON array (`supplierId`, `supplierName`, `productCount`,
  `totalCost`), so the payload no longer grows with transaction volume.

Verified against the previous logic for the current month (main tenant):
identical ranking and totals — אוטולוקס 32 / ₪7,248, דנטייר 29 / ₪3,296,
כסלו 20 / ₪5,637, ראליאנס 11 / ₪1,528, ויקטור 8 / ₪792.

The visible UI (period label, columns, medals, empty state) is unchanged.

---

## 3. Security fix — A4.S1 tenant isolation

Four `SECURITY DEFINER` helpers accepted a caller-supplied business id, had **no
membership check**, and were executable by `PUBLIC`/`anon`:

| Function | Exposure before |
|---|---|
| `get_expiring_products(days_ahead, target_business_id)` | with `target_business_id = NULL` it returned **every business's** products, suppliers and stock — callable while signed out |
| `generate_weekly_stock_summary(target_business_id)` | stock counts for any business id |
| `search_products(search_term, business_uuid, limit)` | product names, barcodes, **cost and price** for any business |
| `get_product_autocomplete(search_term, business_uuid, limit)` | product names for any business |

Applied to all four:

1. `IF NOT public.can_access_business_analytics(<business>, auth.uid()) THEN RAISE 42501`
   — the same guard introduced in Phase A2.S1 (owner, `user_businesses`,
   approved `business_users`, platform admin, or `service_role`).
2. `REVOKE ALL ... FROM PUBLIC, anon;` then
   `GRANT EXECUTE ... TO authenticated, service_role;`

Background jobs are unaffected: `check-expiring-products` and
`generate-weekly-stock-summary` call these with the service-role key, which the
guard short-circuits to allow — including the cross-business
`target_business_id = NULL` scan used by the expiry cron.

`search_products` and `get_product_autocomplete` have no application consumers
today, so the tightening carries no functional risk.

Already secured in Phase A2.S1 and re-verified this phase (guard present,
`anon` revoked): `reports_aggregate`, `yoy_financials`, `bi_analytics_yearly`,
`insights_aggregate`, `get_top_sales_by_dimension`,
`get_last_sale_at_by_product`.

---

## 4. Canonical financial vocabulary

To prevent `remove` vs `sale` drift, all server-side analytics use one rule set,
now applied by every active function:

| Concept | Rule |
|---|---|
| Sale | `action_type IN ('remove','sale')` with `sale_total_ils IS NOT NULL` |
| Purchase | `action_type IN ('add','purchase')` with a purchase amount |
| Exclusions | `is_reversal = false AND reversed_at IS NULL` — always |
| Timezone | `Asia/Jerusalem` for every period boundary |
| VAT | 18% (`revenueNet = revenue / 1.18`) |

No client-side code re-implements these rules for financial totals any more.

---

## 5. Request patterns

- **Reports page** — a single `reports_aggregate` call feeds summary cards, the
  top-20 ranking, insights and charts (`useReportFilters` → `useReportsData` is
  the single source of truth). No duplication found.
- **Dashboard** — `bi_analytics_yearly` (once), `supplier_purchases_by_period`
  (once), `getSummaryStats` (count-only), recent activity and notifications.
  Each widget owns one distinct query key; no duplicate work found.
- Realtime subscriptions were already deduplicated in Phase A3.

---

## 6. Scalability outlook

With the supplier chart consolidated, **no analytics surface returns raw
transaction rows to the browser**. All financial aggregation happens in
Postgres over indexed `business_id` + `timestamp` predicates, so payload size is
now a function of the number of displayed rows rather than of transaction
volume. Current tenant volume: 3,758 `inventory_actions`, 719 products.

## 7. Files changed

- `src/components/dashboard/SuppliersChart.tsx` — raw query → RPC.
- Migration `supplier_purchases_by_period` + A4.S1 guards/grants.
- `docs/PERFORMANCE_PHASE_A4_ANALYTICS.md` (this file).
