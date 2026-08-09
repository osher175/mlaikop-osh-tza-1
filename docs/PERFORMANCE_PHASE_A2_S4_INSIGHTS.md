# Phase A2.S4 — Insights Correctness & Server-Side Aggregation

**Scope:** `src/hooks/useInsights.ts` only. No UI, Reports layout, or billing changes.
**Primary goal:** correctness. Performance secondary.
**Tenant used for ground truth:** `0ed7a81d-cd0b-45fe-9ed7-6961412a7f5f` (2026 YTD, Asia/Jerusalem).

---

## 1. Consumers — the hook is live

| Consumer | Route | Insights rendered |
|---|---|---|
| `src/components/dashboard/InsightsPanel.tsx` | `/dashboard` | all 6 cards |
| `src/components/reports/InsightsTabs.tsx` | `/reports` | all 6 tabs |
| `src/components/dashboard/InsightDetailDrawer.tsx` | both | drill-down item lists |

Not dead code — these insights are user-visible on the two most-used screens.

---

## 2. Queries the old hook issued (per load)

| # | Source | Shape | Rows (live tenant) |
|---|---|---|---|
| 1 | `inventory_actions` + nested `products` + `suppliers` | 90-day window, 14 cols | **836** |
| 2 | `products` | whole business | **717** |
| 3 | `get_last_sale_at_by_product` RPC | whole business | 588 |

Total **~570 kB** over 3 round trips, then reduced in the browser.

---

## 3. Business-rule validation — 6 defects found

### D1 — Action-type mismatch (critical)
The hook matched sales as `action_type = 'remove'`. Live distribution:

| action_type | rows (90d) | rows (YTD) |
|---|---|---|
| `sale` | 836 | **1,232** |
| `remove` | **0** | **0** |

**Every sales-driven insight was computing over an empty set.** Low Margin, High Discount, Stockout Risk and Business Health permanently reported "all clear" — a false negative, not a rounding error.

### D2 — Purchases under-matched
Cost Spike matched `action_type = 'add'` only. Live purchase rows are split `purchase` / `add`, so the 90d-vs-30d cost comparison ran on a partial population.

### D3 — Reversals never excluded
No filter on `is_reversal` / `reversed_at`. Cancelled transactions were counted twice (original + reversal), inflating revenue and discount totals. Same class of bug fixed in A2.S3.

### D4 — Dead Stock false positives
`get_last_sale_at_by_product` shared defect D1, so products selling briskly as `sale` looked "never sold".

| | old | corrected |
|---|---|---|
| Dead Stock (qty > 0) | **373** | **257** |

**116 actively-selling products were wrongly flagged.**

### D5 — Business Health structurally starved
A 12-month calendar chart was drawn from a **90-day** query window. Jan–Apr could never be populated regardless of real sales.

### D6 — Security: `get_last_sale_at_by_product` was open
`SECURITY INVOKER`, no membership check, `EXECUTE` granted to `PUBLIC`/`anon` — inconsistent with the A2.S1 model.

---

## 4. Truncation analysis

| Window | Rows | vs PostgREST 1,000 cap |
|---|---|---|
| 90 days (as shipped) | 836 | 84% — **not yet truncated** |
| YTD (needed for Business Health) | **1,232** | **would silently truncate** |

The 90-day query was ~4 months from silently truncating on its own growth curve, and any correct Business Health fix *required* the YTD window, which truncates today. Fixing D5 client-side would have introduced the A2.S2/S3 truncation bug.

---

## 5. Implementation — `public.insights_aggregate`

Single `SECURITY DEFINER` RPC computing all six insights server-side.

Canonical rules, shared with `reports_aggregate` / `yoy_financials` / `bi_analytics_yearly`:

```
sales     = action_type IN ('remove','sale')  AND sale_total_ils IS NOT NULL
purchases = action_type IN ('add','purchase') AND (purchase_unit_ils OR purchase_total_ils) IS NOT NULL
exclude     is_reversal = true OR reversed_at IS NOT NULL
boundaries  Asia/Jerusalem
VAT         18% (net profit only)
```

- Business Health always aggregates the **full calendar year**, independent of lookback windows.
- Result sets capped server-side (10/20 per category) — matches what the UI displays.
- Thresholds passed as parameters, so `DEFAULT_INSIGHTS_CONFIG` stays authoritative in the frontend.

**Security (A2.S1 model applied to both functions):**

| Function | secdef | search_path | anon EXECUTE | guard |
|---|---|---|---|---|
| `insights_aggregate` | ✔ | `public` | **revoked** | `can_access_business_analytics` |
| `get_last_sale_at_by_product` | ✔ (was invoker) | `public` | **revoked** | `can_access_business_analytics` |

Verified live via PostgREST as `anon`:

```
POST /rpc/insights_aggregate            -> HTTP 401  42501 permission denied
POST /rpc/get_last_sale_at_by_product   -> HTTP 401  42501 permission denied
```

---

## 6. Preserved behavior

Unchanged in `useInsights.ts` and therefore invisible to the UI:

- `InsightsData` / `InsightCard` / item interfaces — identical field names and types
- Severity thresholds (low-margin, discount, stockout, cost-spike, dead-stock counts)
- Hebrew titles, summaries and the Business Health warning sentence
- Hebrew month labels (`MONTH_NAMES_HE`, applied to the RPC's `monthIndex`)
- Query key, `staleTime: 30s`, `refetchOnWindowFocus` reactivity policy

---

## 7. Ground truth — old vs corrected (2026 YTD)

| Metric | Old hook | **Corrected** | Cause |
|---|---|---|---|
| Sales rows matched | **0** | **1,232** | D1 |
| Low Margin items | 0 | **4** (3 at a loss) | D1 |
| High Discount items | 0 | **21** (top 10 shown) | D1 |
| Stockout Risk items | 0 | **42** (top 20 shown) | D1 |
| Dead Stock (qty > 0) | 373 | **257** | D4 |
| Cost Spike items | partial | 0 | D2 |
| Business Health | Jan–Apr always ₪0 | **full Jan–Aug** | D5 |
| Business Health revenue | ₪0.00 | **₪1,028,624.51** | D1/D3/D5 |

Business Health total reconciles **exactly** with `bi_analytics_yearly` (A2.S3) and `yoy_financials` (A2.S2) — ₪1,028,624.51 — confirming all three analytics paths now agree.

Real findings previously hidden, e.g. `2256017 יוקוהמה 99v` — 5 units sold, ₪2.00 revenue, **−₪2,118 gross profit**.

---

## 8. Performance

| | Before | After | Δ |
|---|---|---|---|
| Round trips | 3 | **1** | −67% |
| Rows to client | 2,141 | **0** (aggregated) | — |
| Payload | **583,237 B (570 kB)** | **10,874 B (10.6 kB)** | **−98.14%** |
| Aggregation | browser (~570 kB reduce) | Postgres | — |

---

## 9. Verification

| Check | Result |
|---|---|
| `tsgo --noEmit` | **PASS** (0 errors) |
| `vite build` | **PASS** (13.54s; bundle 1,609.20 → 1,603.85 kB) |
| ESLint `useInsights.ts` | **PASS** (0 problems) |
| ESLint baseline `src/` | **108 errors — unchanged** |
| Smoke: `/dashboard` `/reports` `/inventory` `/procurement` `/auth` | **0 console errors** |
| Anon RPC access | **401 / 42501 on both functions** |
| Cross-analytics reconciliation | **exact match with A2.S2 & A2.S3** |

---

## 10. Not done (out of scope)

- No UI, Reports layout, or billing changes.
- Category/brand insight dimensions not added.
- The 108-error ESLint baseline was not addressed.
