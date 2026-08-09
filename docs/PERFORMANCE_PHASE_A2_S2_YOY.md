# Mlaiko — Phase A2.S2: Year-over-Year Correctness & Row-Truncation Fix

Date: 2026-08-09
Scope: `src/hooks/useYearOverYear.ts` and one new analytics RPC. Nothing else.
Related: `docs/PERFORMANCE_PHASE_A2_RESULTS.md` §6, `docs/PERFORMANCE_PHASE_A2_S1_SECURITY_FIX.md`

---

## 1. Original implementation

`useYearOverYear` (245 lines) issued **one** PostgREST request:

```ts
supabase.from('inventory_actions')
  .select('id, action_type, quantity_changed, timestamp, sale_total_ils,
           discount_ils, discount_percent, cost_snapshot_ils, purchase_total_ils')
  .eq('business_id', businessContext.business_id)
  .gte('timestamp', earliestStart.toISOString())   // 2024-01-01 local
  .lte('timestamp', latestEnd.toISOString())       // 2026-12-31 23:59:59.999 local
  .order('timestamp', { ascending: false });
```

- **No `.range()`, no pagination, no `.limit()`.** The response size was entirely at the mercy of the server-side row cap.
- Ordered **`timestamp DESC`**, so any cap would silently keep the *newest* N rows and drop all older ones.
- All 3 years of yearly totals, 36 months of monthly totals and the YoY comparison were then computed in the browser from that single array.

### Consumers

**None.** `rg` across the whole repository found `useYearOverYear` referenced only by its own definition and by documentation files. No page, component or other hook imports it.

This is an important qualifier for everything below: the incorrect figures documented here were **not** rendered to users, because nothing renders them. The hook is currently dead code that was scheduled to back a Reports YoY widget. It has been fixed so it is correct whenever it is wired up.

## 2. Was truncation confirmed?

**Partially — and the honest answer has two halves.**

**Confirmed:** the query returns far more rows than any reasonable cap. Authoritative counts from the database:

| Metric | Rows |
|---|---|
| `inventory_actions`, all tenants | **3,757** |
| Inside the hook's 2024-01-01 → 2026-12-31 window, all tenants | **3,757** |
| Inside the window, for the main tenant `צמיגי פאר` | **3,755** |

**Not confirmed:** the exact cap value could not be measured from this sandbox. `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` (BYO Supabase — the preview cannot inject a session), no service-role key is present, `PGHOST` is unset, and the read-only SQL role cannot `SET ROLE`. An empirical probe of PostgREST with the anon key (`Range: 0-4999`, `Prefer: count=exact` against a 1,068-row table) returned `content-range: */0` — RLS blocks anon, so no cap could be observed. `pg_roles.rolconfig` contains no `pgrst.db_max_rows`, meaning the cap is set at the PostgREST process level and is not readable from SQL.

So: **truncation is not directly proven, but its impact was quantified.** Simulating a 1,000-row cap in SQL (newest 1,000 rows by `timestamp DESC`, exactly what PostgREST would return) against the real data:

| Metric, year 2026 | Full data | Newest 1,000 rows | Error |
|---|---:|---:|---:|
| Purchases, under the **old** rules | 133,295.32 | 92,391.32 | **−40,904.00 (−30.7%)** |
| Revenue, under the **corrected** rules | 1,028,624.51 | 582,598.71 | **−446,025.80 (−43.4%)** |

If the cap is the Supabase default of 1,000, the hook was already understating purchases by roughly a third. The fix removes the dependency on the cap entirely, so the exact value stops being load-bearing.

## 3. CORRECTNESS BUG — HIGH PRIORITY (larger than truncation)

While establishing ground truth, a **more severe** defect surfaced that has nothing to do with row limits.

The hook recognised sales as:

```ts
a.action_type === 'remove' && a.sale_total_ils != null
```

Actual action-type distribution for the main tenant:

| `action_type` | rows | with `sale_total_ils` | with `purchase_total_ils` | with `cost_snapshot_ils` |
|---|---:|---:|---:|---:|
| `sale` | 1,236 | **1,236** | 0 | 1,236 |
| `remove` | 1,204 | **0** | 0 | 0 |
| `add` | 1,026 | 0 | 109 | 0 |
| `purchase` | 289 | 0 | **289** | 0 |

Every real sale is recorded as `action_type = 'sale'`. **Not one `remove` row carries `sale_total_ils`.** The hook's sales filter therefore matched **zero rows in every year**.

Consequence — the hook produced, for *all* years, with the *full* dataset:

- `totalRevenue` = **0**
- `totalRevenueNet` = **0**
- `grossProfit` = **0**
- `netProfit` = **0**
- `totalDiscounts` = **0**
- `transactionCount` = **0**

Purchases were also understated: the hook counted only `add` + `purchase_total_ils` (109 rows) and ignored the 289 `purchase` rows.

And because `previousYearData.totalRevenue > 0` gated the comparison block, `comparisons` evaluated to **`null` permanently** — the YoY comparison could never have rendered at all.

This is consistent with the project's own documented rule (`mem://features/analytics/dual-action-type-support`: analytics treat both `remove` and `sale` as sales events) and with `reports_aggregate`, which already uses `action_type='remove' OR action_type='sale'`. `useYearOverYear` had simply not been updated when `sale` / `purchase` were introduced.

## 4. Ground truth vs. old implementation

Tenant `צמיגי פאר`, computed with read-only PostgreSQL aggregates, boundaries in `Asia/Jerusalem`.

### Year 2026 (current)

| Metric | DB ground truth | Old hook (full data) | Old hook (if capped at 1,000) |
|---|---:|---:|---:|
| `totalRevenue` | **1,028,624.51** | 0.00 | 0.00 |
| `totalRevenueNet` | **871,715.69** | 0.00 | 0.00 |
| `totalPurchases` | **427,430.51** | 133,295.32 | 92,391.32 |
| COGS | **360,215.08** | 0.00 | 0.00 |
| `grossProfit` | **668,409.43** | 0.00 | 0.00 |
| `netProfit` | **511,500.61** | 0.00 | 0.00 |
| `totalDiscounts` | **79,220.30** | 0.00 | 0.00 |
| `transactionCount` | **1,232** | 0 | 0 |

### Years 2025 and 2024 (previous / comparison periods)

All metrics are **0.00 / 0 in both ground truth and the old hook**. This is genuine, not a bug: the 1,752 rows in 2025 are `remove` and `add` rows with no financial fields populated, and 2024 has no rows at all. The first financially-recorded sale is **2026-01-25**.

### Comparison block

`previousYear` (2025) revenue is 0 in ground truth too, so `comparisons` is legitimately `null` both before and after the fix. The YoY delta becomes meaningful only once a second year of financial data exists.

**Net finding:** the current production YoY figures were **wrong** — revenue, net revenue, gross profit, net profit, discounts and transaction count were all reported as zero against a true 2026 revenue of ₪1,028,624.51, and purchases were understated by ₪294,135.19 (−68.8%). Truncation was an *additional*, compounding error on top of that.

## 5. Business rules — preserved vs. deliberately corrected

| Rule | Old hook | New RPC | Verdict |
|---|---|---|---|
| Tenant scoping | `business_id` filter | `business_id` filter **+ server-side authorization** | strengthened |
| Year window | last 3 years, floor 2020 | identical (`p_years=3`, floor 2020) | preserved |
| Year boundary | Jan 1 00:00:00.000 → Dec 31 23:59:59.999 | identical | preserved |
| Month boundary | calendar month, 12 zero-filled months/year | identical | preserved |
| Timezone | **browser local** | **`Asia/Jerusalem`** (explicit) | see note |
| VAT | `revenueNet = revenue / 1.18` | identical | preserved |
| Gross profit | `revenue − COGS` (gross incl. VAT, intentionally mixed) | identical | preserved |
| Net profit | `revenueNet − COGS` | identical | preserved |
| COGS | `Σ cost_snapshot_ils × ABS(quantity_changed)` over sales | identical | preserved |
| Discounts | `Σ discount_ils` over sales | identical | preserved |
| Transaction count | count of sales rows | identical | preserved |
| Null handling | `Number(x) || 0` | `COALESCE(x, 0)` | equivalent |
| Rounding | 2 dp | 2 dp (`ROUND(...,2)`) | preserved |
| Comparison logic | requires prev-year revenue > 0; `%` uses `ABS(prev)` for profit | identical | preserved |
| **Sales rule** | `action_type='remove'` only | **`action_type IN ('remove','sale')`** | **corrected — see §3** |
| **Purchases rule** | `action_type='add'` only | **`action_type IN ('add','purchase')`** | **corrected — see §3** |
| **Reversals** | **not excluded** | **excluded** (`is_reversal=false AND reversed_at IS NULL`) | **corrected** |

Three rules were deliberately changed rather than preserved. Each is a defect, each is documented above, and each brings the hook into line with `reports_aggregate` and with the project's documented analytics rules. Preserving them verbatim would have meant shipping a hook that reports zero revenue.

**Timezone note:** the old hook used `new Date(year, 0, 1)`, i.e. the *browser's* timezone. For the Israeli user base that is already `Asia/Jerusalem`, so behaviour is unchanged in practice; the RPC now makes it explicit and deterministic regardless of client clock, matching `mem://style/timezone-normalization-policy`.

**`reports_aggregate` was not reused.** Field-by-field comparison showed it does not expose `total_discounts`, per-year splits, a 12-month breakdown, or `transactionCount` with the same definition, and its purchases rule differs. Bending it to fit would have changed a function that four other hooks depend on — out of scope for A2.S2.

## 6. The fix

### New RPC

`public.yoy_financials(p_business_id uuid, p_years integer DEFAULT 3) RETURNS jsonb`

`STABLE`, `SECURITY DEFINER`, `SET search_path TO 'public'`.

Structure: one CTE (`scope`) filters and buckets the rows by year/month in `Asia/Jerusalem`; `cells` left-joins a `generate_series` grid to guarantee 12 zero-filled months for every requested year; `per_year` rolls the cells up. No nested aggregates (`mem://infrastructure/database/sql-aggregation-nesting-pattern`). Returns:

```json
{ "years": [ ... 8 fields per year ... ],
  "monthlyByYear": { "2026": [ ... 12 × 8 fields ... ] },
  "comparisons": { ... } | null }
```

Month **labels** are not returned — the RPC emits `monthIndex` and the hook maps it through `MONTH_NAMES_HE`, keeping Hebrew i18n in the frontend.

### Two migrations were applied

1. The initial version used a `CREATE TEMP TABLE` staging step. That is DDL inside a `STABLE` function and would fail in a read-only transaction — a latent runtime failure.
2. It was immediately rewritten as pure CTEs with no DDL. Rules, output shape, name, signature and grants are byte-identical between the two; only the internal mechanism changed. The deployed version is the CTE one.

### Frontend

`src/hooks/useYearOverYear.ts` went from 245 lines to 105. The exported API is **unchanged** — `{ yoyData, isLoading, error, hasData }`, same `YearOverYearData` / `MonthlyFinancialData` / `YearlyFinancialData` shapes, same `queryKey`, same `staleTime` / `gcTime` / `refetchOnWindowFocus`. A future consumer needs no adaptation. The raw `.from('inventory_actions')` select is replaced by a single `supabase.rpc('yoy_financials', ...)` call.

## 7. Security model

The RPC reuses the Phase A2.S1 model verbatim:

```sql
IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
  RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
END IF;
```

placed as the first statement after `BEGIN`, before any data is touched.

```sql
REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.yoy_financials(uuid, integer) TO authenticated, service_role;
```

| Requirement | Status |
|---|---|
| No anonymous access | **Verified** — `POST /rest/v1/rpc/yoy_financials` with the publishable key returns **HTTP 401 / `42501 permission denied for function yoy_financials`** |
| No caller-controlled cross-tenant access | `p_business_id` validated server-side against `auth.uid()`; predicate truth table verified in A2.S1 (owner-A vs business-B = denied, both directions) |
| Authorized users only | owner, `user_businesses`, approved `business_users`, system admin |
| Service role compatible | retained for the Public Read API pattern |
| Safe `search_path` | `SET search_path TO 'public'`, all objects schema-qualified |
| No RLS weakening | no policy, table or grant outside this function was touched |

## 8. Large-dataset safety

Correctness no longer depends on row count, because **no raw rows cross the network**. Aggregation happens inside Postgres, where the PostgREST row cap does not apply; the response is always one JSON object.

| Actions in range | Old design | New design |
|---|---|---|
| 1,000 | borderline — at or on the cap | 1 object, exact |
| 10,000 | ~90% of rows dropped, badly wrong | 1 object, exact |
| 100,000+ | ~99% dropped; ~26 MB if uncapped | 1 object, exact |

The output size is fixed by the *shape* of the request (`p_years` × 12 months), not by the data volume: 3 years is always 3 year objects + 36 month objects, whether the tenant has 100 actions or 10 million. Scaling cost stays server-side, where it belongs, and is served by the existing `business_id` / `timestamp` access path.

## 9. Network / data-transfer improvement

Measured against the real 2024–2026 window for `צמיגי פאר`, by serialising the exact selected columns to JSON in the database.

| | Before | After |
|---|---|---|
| Requests fired | 1 | 1 |
| Raw rows transferred | **3,755** | **0** |
| Aggregate objects returned | 0 | 1 (3 years + 36 months + comparisons) |
| Response payload | **1,005,131 bytes (982 kB)** | **6,504 bytes (6.4 kB)** |
| Reduction | — | **−99.35% (≈154× smaller)** |

Payload figures are measured (`length(jsonb::text)`), not estimated. They exclude HTTP/gzip overhead, which would compress both sides but not change the ratio materially.

## 10. Accuracy verification

The RPC could not be executed directly from this sandbox — the read-only SQL role is not in its ACL (`permission denied for function yoy_financials`), which is itself confirmation that the grants are tight. Verification was therefore done by running the RPC's **exact CTE body** as an inline read-only query and comparing to the independently-written ground-truth aggregates from §4.

| Metric | Ground truth (§4) | RPC logic, inline | Match |
|---|---:|---:|:--:|
| 2026 `totalRevenue` | 1,028,624.51 | 1,028,624.51 | exact |
| 2026 `totalRevenueNet` | 871,715.69 | 871,715.69 | exact |
| 2026 `totalPurchases` | 427,430.51 | 427,430.51 | exact |
| 2026 `grossProfit` | 668,409.43 | 668,409.43 | exact |
| 2026 `netProfit` | 511,500.61 | 511,500.61 | exact |
| 2026 `totalDiscounts` | 79,220.30 | 79,220.30 | exact |
| 2026 `transactionCount` | 1,232 | 1,232 | exact |
| 2025 (previous period), all metrics | 0.00 / 0 | 0.00 / 0 | exact |
| 2024, all metrics | 0.00 / 0 | 0.00 / 0 | exact |
| Months emitted per year | 12 | 12 | exact |

Every financial total matches to the cent. Both the current comparison period (2026) and the previous one (2025) were checked.

**Residual gap:** the plpgsql wrapper — the guard, `p_years` clamping, `jsonb_build_object` envelope and the comparison block — is verified by construction and by typecheck of the consuming code, not by live execution. The two migrations applied cleanly, which confirms the function parses and its plan is valid.

## 11. Regression verification

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit -p tsconfig.app.json`) | **PASS** — 0 errors |
| ESLint, `src/hooks/useYearOverYear.ts` | **clean** — 0 errors, 0 warnings |
| ESLint, whole `src/` | 111 errors / 14 warnings — **identical to the pre-change baseline** |
| Production build (`vite build`) | **PASS** — exit 0 |
| Browser smoke (Playwright) | `/dashboard`, `/inventory`, `/reports`, `/procurement`, `/auth` load; `/admin` correctly redirects to `/auth`; **0 console errors, 0 page errors** |
| Anonymous access to the new RPC | **HTTP 401 / 42501** |
| Dashboard / Reports / Insights | untouched — no other hook, component or query was modified |
| YoY widgets | none exist yet (§1); the hook's public API is unchanged for whoever wires one up |

## 12. Scope confirmation

Changed:
- `src/hooks/useYearOverYear.ts` — rewritten to call the RPC.
- `public.yoy_financials(uuid, integer)` — new function + its grants.
- `docs/PERFORMANCE_PHASE_A2_S2_YOY.md` — this file.

Not changed: no table, index, RLS policy, trigger, data row, or other function; `reports_aggregate`, `get_top_sales_by_dimension` and `can_access_business_analytics` were read but not modified; `useInsights`, `useBIAnalytics`, Dashboard analytics, Reports layout, chart libraries, billing/subscription, procurement and import were not touched; no frozen file under `CODE_FREEZE_SUBSCRIPTION.md`; no dependency changes.

## 13. Remaining analytics risks

1. **`useBIAnalytics` has the same two defects.** It fetches raw `inventory_actions` for a full year with no pagination (same cap exposure) and should be checked for the same `remove`-only action-type assumption. Highest-value next target.
2. **`useInsights`** also reads raw rows over a full year — same cap exposure.
3. **The `remove` vs `sale` split is a data-model smell.** 1,204 `remove` rows carry no financial data at all. Worth deciding whether `remove` is a non-financial adjustment type and, if so, documenting it, because every analytics surface currently has to guess.
4. **The PostgREST row cap is still unmeasured.** Reading the project's `PGRST_DB_MAX_ROWS` from the Supabase dashboard would let every remaining raw-row hook be triaged precisely instead of by simulation.
5. **`reports_aggregate` is still `VOLATILE`** (proposal item S3) — it cannot be inlined or cached by the planner.
6. **Duplicate index** `idx_api_usage_key_time` vs `idx_api_key_usage_log_key_created` (proposal item C1) is still present.

## 14. Rollback

```sql
DROP FUNCTION IF EXISTS public.yoy_financials(uuid, integer);
```

and restore `src/hooks/useYearOverYear.ts` from version control. Note that rolling back reinstates the zero-revenue defect described in §3.
