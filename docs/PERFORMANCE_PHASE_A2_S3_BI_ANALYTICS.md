# Phase A2.S3 — BI Analytics Correctness & Server-Side Aggregation

**Status:** ✅ Complete
**Scope:** `useBIAnalytics` (Dashboard revenue + monthly purchases charts)
**Related:** A2.S1 (tenant isolation), A2.S2 (YoY correctness)

---

## 1. Active UI Surface

`useBIAnalytics` is **live** and feeds two Dashboard components:

| Component | Consumed fields |
|---|---|
| `RevenueChart` | `salesData`, `hasSaleData`, `currentYear` |
| `MonthlyPurchasesChart` | `monthlyPurchases`, `hasPurchaseData` |

`topProducts`, `supplierData` and `metrics` are computed but not currently rendered — they are **retained in the contract** so no consumer can break.

---

## 2. Query Shape — Before

The hook issued a single PostgREST read for the whole calendar year:

```
inventory_actions
  .select(action_type, quantity_changed, timestamp, sale_total_ils,
          discount_ils, discount_percent, cost_snapshot_ils,
          purchase_total_ils, supplier_id,
          products(id, name, suppliers(id, name)))
  .eq(business_id, …)
  .gte(timestamp, Jan 1)  .lte(timestamp, Dec 31)
```

All 12 monthly buckets, top products, supplier splits and yearly metrics were then
reduced **in the browser**.

---

## 3. Findings

### 3.1 Silent row truncation (critical)

PostgREST caps unbounded reads at **1,000 rows**. The 2026 window for the main
tenant contains **2,003 rows**.

| | Value |
|---|---|
| Rows in window | 2,003 |
| Rows actually delivered | 1,000 (newest first) |
| Share of data seen by the chart | **~50%** |

Because the cap keeps the **newest** rows, the **oldest months were starved**:

* January–March 2026 rendered as **₪0.00** revenue.
* April 2026 was understated by **~68%**.

### 3.2 Reversals were double-counted (correctness)

Unlike `reports_aggregate` and `yoy_financials`, the client-side reducer never
filtered `is_reversal = true` / `reversed_at IS NOT NULL`. A cancelled sale was
counted **twice** — once as the original sale and once as its reversal.

* Rows in window: 2,003 → **1,999 live** (4 reversal-related rows).
* Overstatement removed from 2026 revenue: **₪1,960**.

### 3.3 Action-type rules

Verified against live data. The hook's own rules were correct in spirit but not
aligned with the other aggregates. The RPC now uses the shared project rules:

```
sales     = action_type IN ('remove','sale')   AND sale_total_ils     IS NOT NULL
purchases = action_type IN ('add','purchase')  AND purchase_total_ils IS NOT NULL
```

---

## 4. Fix — `public.bi_analytics_yearly(p_business_id uuid, p_year int)`

A single `SECURITY DEFINER`, `STABLE`, `SET search_path = public` RPC that
aggregates everything in one pass via CTEs and returns `jsonb`.

**Business rules applied**

* Reversals excluded (`is_reversal = false AND reversed_at IS NULL`).
* Month boundaries in **`Asia/Jerusalem`**.
* VAT **18%** (`revenueNet = revenue / 1.18`).
* Zero-filled 12-month series so charts never have gaps.

**Security** — reuses the A2.S1 guard:

```sql
IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
  RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
END IF;
```

Grants are tight — no `PUBLIC`, no `anon`:

```
bi_analytics_yearly: postgres=X | authenticated=X | service_role=X
```

**Localization** — the RPC returns `monthIndex` (0–11) only. Hebrew month labels
stay in the frontend (`MONTH_NAMES_HE`), keeping the DB locale-agnostic.

---

## 5. Ground Truth Verification

Aggregation replicated directly against production data:

| Metric | Old hook (truncated, reversals counted) | **RPC (correct)** |
|---|---|---|
| Total revenue | ~₪0 for Jan–Mar, heavy understatement | **₪1,028,624.51** |
| Total revenue (net of VAT) | — | **₪871,715.70** |
| Total purchases | — | **₪427,430.51** |
| Gross profit | — | **₪668,409.43** |
| Net profit | — | **₪511,500.62** |
| Total discounts | — | **₪79,220.30** |

Yearly totals match `yoy_financials` for 2026 (**₪1,028,624.51**) — the two
independent aggregates now agree, which they did not before.

> Sub-agora note: yearly totals are the **sum of per-month rounded values**
> (matching the hook's historical behaviour), so they may differ from a
> single-pass rounding by ≤ ₪0.01.

---

## 6. Payload Reduction

| | Rows | Payload |
|---|---|---|
| Before (raw rows + nested product/supplier joins) | 2,003 | **823,737 B (804 kB)** |
| After (aggregated JSON) | 1 | **6,081 B (5.9 kB)** |
| **Reduction** | | **−99.26%** |

---

## 7. Frontend Change

`src/hooks/useBIAnalytics.tsx` now calls the RPC and only maps `monthIndex` →
Hebrew label. The returned object keeps every previously exported key:

```
salesData, topProducts, supplierData, monthlyPurchases,
metrics, hasData, hasSaleData, hasPurchaseData, currentYear
```

The unused `financialActions` raw dump was dropped (no consumer referenced it).
Query options (`staleTime: 0`, `refetchOnWindowFocus`, `refetchOnMount: 'always'`)
are unchanged, preserving the project's real-time reactivity policy.

---

## 8. Verification

| Check | Result |
|---|---|
| Typecheck (`tsgo`) | ✅ PASS |
| Production build (`vite build`) | ✅ PASS — 12.31s |
| ESLint on changed file | ✅ Clean |
| ESLint baseline | ✅ 111 → **108** errors (3 `any` removed, none added) |
| Anonymous RPC call | ✅ **HTTP 401 / `42501` permission denied** |
| Function ACL | ✅ `authenticated` + `service_role` only |
| Browser smoke (`/dashboard`, `/inventory`, `/reports`, `/procurement`, `/auth`) | ✅ 0 console errors |

---

## 9. Next Target

`src/hooks/useInsights.ts` still uses the raw-row pattern over a full year and is
subject to the same 1,000-row truncation — recommended as **Phase A2.S4**.
