# Phase A — Performance & Architecture Audit (read-only)

Produce a single deliverable, `docs/PERFORMANCE_ARCHITECTURE_AUDIT.md`. No production code, database, RLS, Edge Function, dependency or UI changes.

## Scope of investigation

1. **Frontend rendering** — page/component trees under `src/pages` and `src/components` (dashboard, inventory, reports, procurement), memoization, effect dependencies, state placement.
2. **Data fetching** — every hook in `src/hooks` (~50 files) plus `src/lib/data/*`: query keys, `select` shapes, filters, row volumes, duplicate/parallel fetches, client-side aggregation.
3. **Database access patterns** — read-only `supabase--read_query` inspection of `pg_indexes`, table row counts, and `pg_stat_statements` (via the slow-query tool) for products, inventory_actions, suppliers, procurement, categories, notifications. Recommend indexes; create none.
4. **Multi-tenant / RLS** — how `business_id` is resolved (`useBusinessAccess`, `get_user_business_context`, security-definer helpers), repeated tenant lookups, policy evaluation cost. Anything with isolation implications gets flagged SECURITY-SENSITIVE.
5. **Dashboard & analytics** — full trace of `Dashboard.tsx` → `SummaryGrid`, `InsightsPanel`, `RevenueChart`, `TopSalesByDimension`, `SuppliersChart`, `MonthlyPurchasesChart`, `RecentActivity`, `NotificationPanel`, and the hooks behind them (`useBIAnalytics`, `useInsights` (587 lines), `useReportsData`, `useSalesByDimension`, `useDashboardReportsData`, `useYearOverYear`), listing every request fired on load.
6. **Large lists/tables** — Inventory, Products, Suppliers, Procurement, Supplier Invoices, Reports: page size, virtualization use (`react-window`), client vs server filtering/sorting/search, DOM size.
7. **React Query strategy** — global defaults (`staleTime` 5m / `gcTime` 10m in `App.tsx`) vs per-hook overrides, key collisions, invalidation breadth on mutations.
8. **Realtime** — `useRealtimeDashboard`, `useRealtimeActivity`, `useRealtimeReports`: subscription count, duplication, cleanup, and how broadly each event refetches.
9. **Bundle & initial load** — no lazy loading exists today (zero `React.lazy` in `src`); quantify weight of recharts, xlsx, jspdf, @zxing, react-day-picker, embla, and the eagerly imported admin/procurement routes. A temporary production build with `--mode development` disabled will be run only to read chunk sizes; no build artifacts are committed (`dist/` documented as generated and removed).
10. **Edge Functions & network** — call sites and response shapes for the ~25 functions in `supabase/functions`, focusing on repeated/sequential invocations from the client.
11. **Scalability simulation** — behaviour at 10k products / 100k inventory actions / 100k sale rows / several years of history; which screen degrades first.
12. **Baseline measurement** — Playwright run against the local dev server on `/`, `/dashboard`, `/inventory`, `/reports` capturing request count, response sizes, and timing. Anything not reliably measurable in this environment will be stated as unmeasured rather than estimated.

## Report structure

Executive Summary (GOOD / ACCEPTABLE / NEEDS OPTIMIZATION / CRITICAL with justification) · Top Bottlenecks ranked P0–P3 (area, exact file/query, current behaviour, why inefficient, growth impact, recommended fix, implementation risk) · Quick Wins · Structural Improvements · Database Recommendations · Dashboard Findings · Scalability Risks · Optimization Roadmap (A1 Safe Quick Wins, A2 Database & Query, A3 Frontend, A4 Analytics, A5 Scale Verification — each with impact/risk/complexity) · Final Safety Checklist.

## Notes and constraints

- Billing/subscription files stay untouched and are only read; the code freeze in `CODE_FREEZE_SUBSCRIPTION.md` is respected.
- Database access is limited to read-only `SELECT` and catalog/statistics queries.
- Closing chat summary: verdict, P0/P1/P2/P3 counts, top 5 bottlenecks, top 5 quick wins, growth-readiness answer, and confirmation that only the report file was added.
