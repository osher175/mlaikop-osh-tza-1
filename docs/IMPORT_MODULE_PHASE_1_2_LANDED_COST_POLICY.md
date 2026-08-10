# Import Module — Phase 1.2: Landed Cost Finalization Policy

Date: 2026-08-10
Closes the P1 blocker raised in `docs/IMPORT_MODULE_PHASE_1_1_VERIFICATION.md` §7.
Scope: cost model + landed cost only. No Receiving, no `products.cost` write, no inventory mutation.

---

## 1. Policy (canonical)

> **A logical cost line has exactly one effective value.**
> If a final amount exists → use the final amount.
> Otherwise → use the estimated amount.
> The landed-cost overhead pool is the **sum of effective values across all cost lines**.
> An estimate and its own final value are **never** summed.
> Deduplication is **per cost line — never per category.** Several distinct lines in the same
> category all count in full.

Example:

| Cost line | Category | Estimated | Final | Effective |
|---|---|---|---|---|
| International freight | `international_freight` | ₪10,000 | ₪10,500 | **₪10,500** |
| Fuel surcharge | `international_freight` | ₪1,200 | ₪1,200 | **₪1,200** |
| **Effective freight-related total** | | | | **₪11,700** (never ₪20,500, never ₪10,500) |

---

## 2. Chosen model — one row per logical cost line

`import_costs` already had `amount`, `currency_code`, `exchange_rate_to_ils`, generated
`amount_ils`, and a `cost_state` flag (`estimated` / `final`). The old flag was purely descriptive —
nothing prevented two rows for the same expense, and landed cost summed them both.

Chosen approach: **A — one row carries both values.** This was preferred over linked
estimate/final records with a `cost_line_id` group key because:

- Zero identity bookkeeping: the row's own `id` *is* the stable cost-line identity, so no group key
  to generate, backfill, index, validate or accidentally split.
- Impossible to double count by construction — there is only one row per expense, so no aggregation
  rule can be bypassed by a malformed insert.
- Existing rows, RLS policies, triggers, indexes and child references (`import_payments.import_cost_id`)
  keep working untouched.
- History is preserved on the same row: the estimate stays in `amount`.

### Columns added to `import_costs`

| Column | Type | Meaning |
|---|---|---|
| `amount` *(existing)* | numeric | **Estimated** (original) amount, in `currency_code` |
| `final_amount` | numeric, null | Final/invoiced amount for the **same** line |
| `final_exchange_rate_to_ils` | numeric, null | FX rate for the final amount (falls back to the estimate's rate) |
| `final_invoice_reference` | text, null | Supplier/broker invoice reference for the final value |
| `final_cost_date` | date, null | Date of the final invoice |
| `finalized_at` / `finalized_by` | timestamptz / uuid | Set automatically on first finalization |
| `amount_ils` *(existing, generated)* | numeric | Estimated value in ILS |
| `final_amount_ils` | numeric, generated | Final value in ILS (`NULL` when no final) |
| **`effective_amount_ils`** | numeric, generated | `COALESCE(final, estimate)` in ILS — **the only value landed cost sums** |
| `variance_ils` | numeric, generated | `final_ils − estimated_ils` (`NULL` when no final) |
| `variance_percent` | numeric, generated | `variance / estimated × 100`, `NULL` when the estimate is 0 |

All derived columns are **stored generated columns**, so the rule is enforced by the database itself
and cannot be bypassed by any client, RPC or future code path.

Constraints: `final_amount >= 0`, `final_exchange_rate_to_ils > 0`,
and `final_exchange_rate_to_ils` may only be set when `final_amount` is present.

### `cost_state` is now derived, not user-entered

Trigger `import_costs_sync_state()` (BEFORE INSERT/UPDATE) sets
`cost_state = 'final'` when `final_amount IS NOT NULL`, otherwise `'estimated'`, and stamps
`finalized_at` / `finalized_by` on the first finalization (cleared if the final value is removed).
The state can no longer drift from the data.

### Backfill (no behavior change)

Rows already flagged `cost_state = 'final'` were converted with
`final_amount := amount`, `final_exchange_rate_to_ils := exchange_rate_to_ils`.
Their `effective_amount_ils` equals their previous `amount_ils`, so **no existing order's landed
cost changed** as a result of the migration.

---

## 3. Landed cost calculation

`import_order_landed_cost(p_import_order_id)` — single line changed:

```sql
-- before: SUM(amount_ils)            -- summed estimates AND finals  (double count)
SELECT COALESCE(sum(effective_amount_ils), 0) INTO v_overhead
FROM public.import_costs WHERE import_order_id = p_import_order_id;
```

Everything else is unchanged: unit base excludes cancelled items, `overhead_per_unit = overhead / units`
rounded to 4 decimals, `NULL` when units = 0, margin `NULL` when the planned sale price is absent or 0.
The tenant guard (`can_manage_business_imports`, `42501`) is intact and `EXECUTE` remains
`authenticated`-only.

### New read model — `import_order_cost_summary(p_import_order_id)`

Returns `lines`, `finalized_lines`, `estimated_total_ils`, `final_total_ils`,
`effective_total_ils`, `variance_ils`, `variance_percent`. Same tenant guard, `authenticated` only.
`effective_total_ils` is the exact overhead pool used by landed cost, so the UI can never display a
total that disagrees with the calculation.

### Audit

New event type `cost_finalized` is logged (with estimated, final, variance, variance %) the first
time a line receives a final amount; ordinary edits still log `cost_updated`. Estimates are never
deleted, so the trail shows both values plus the variance at finalization time.

---

## 4. Deterministic verification

### 4.1 Per-line effective value, variance and no double counting

Executed against the database using the exact generated-column expressions:

| Line | Category | Estimated ₪ | Final ₪ | Effective ₪ | Variance | Variance % |
|---|---|---|---|---|---|---|
| L1 estimate → finalized | international_freight | 7,500.00 | 8,000.00 | **8,000.00** | +500.00 | +6.67% |
| L2 estimate only (zero) | insurance | 0.00 | — | **0.00** | — | — (guarded ÷0) |
| L3 second line, same category | international_freight | 1,100.00 | 1,200.00 | **1,200.00** | +100.00 | +9.09% |
| L4 final only (final = estimate) | port | 900.00 | 900.00 | **900.00** | 0.00 | 0.00% |
| L5 FX: 1,000 @3.7 est → @3.9 final | customs | 3,700.00 | 3,900.00 | **3,900.00** | +200.00 | +5.41% |
| **Totals** | | 13,200.00 | 14,000.00 | **14,000.00** | +800.00 | |

- L1 + L3 prove **category is not deduplicated**: both freight-category lines count in full
  (8,000 + 1,200 = 9,200 effective).
- No effective total anywhere equals estimate + final for the same line (L1 is 8,000, never 15,500).
- L5 confirms each side of the line carries its own FX rate and both are retained.

### 4.2 Landed cost, spec scenario

Product A 100 units @ ₪100/unit, Product B 300 units @ ₪150/unit (400 units total),
cost line 1 estimated ₪7,500 → final ₪8,000, cost line 2 absent/zero:

| Scenario | Overhead pool | Per unit | Product A | Product B | A margin @ ₪200 |
|---|---|---|---|---|---|
| **Spec — line finalized (₪8,000)** | 8,000 | **₪20.0000** | **₪120.0000** | **₪170.0000** | 40.00% |
| Estimate only (₪7,500) | 7,500 | ₪18.7500 | ₪118.7500 | ₪168.7500 | 40.63% |
| No cost lines / cost line deleted | 0 | ₪0.0000 | ₪100.0000 | ₪150.0000 | 50.00% |
| Zero units | 8,000 | `NULL` | `NULL` | `NULL` | `NULL` (no ÷0) |
| Naive double count (7,500+8,000) — **must not occur** | 15,500 | ₪38.7500 | ₪138.7500 | ₪188.7500 | 30.63% |

Actual result matches the spec exactly: **₪20/unit → A = ₪120, B = ₪170**. The double-count row is
shown only to document what the old behavior would have produced.

### 4.3 Case coverage

| Case | Result |
|---|---|
| Estimate only | effective = estimate; `final_amount_ils`, variance = `NULL` |
| Estimate later finalized | effective switches to final; estimate preserved in `amount`; `cost_finalized` event logged |
| Multiple separate costs, same category | all count in full — no category-level merging |
| Final-only cost | entered as one line whose estimate equals the final; variance 0 |
| Zero units | `overhead_per_unit`, landed cost, profit, margin all `NULL` |
| Zero estimate | `variance_percent` = `NULL` (no divide-by-zero); variance in ₪ still shown |
| Cancelled item | excluded from the unit base, still listed |
| Deleted cost line | disappears from the pool (row delete, allowed by RLS); no orphan value |
| Un-finalize (clear the final amount) | reverts to estimate; `cost_state`, `finalized_at`, `finalized_by` cleared automatically |
| Double counting | structurally impossible — one row per line, effective value computed by the database |

---

## 5. UI changes

`ImportOrderDetail.tsx` → costs tab:

- The add-cost form now captures the **estimate** only (the manual `cost_state` picker was removed —
  the state is derived).
- Each cost row shows: estimated ₪, final ₪, variance (₪ and %, colored), and the effective value
  used in the calculation, plus an inline field to record/clear the final amount.
- Four summary cards: total estimated, total final, **effective total used for landed cost**, and
  variance vs. the estimate.
- `useImportOrder` exposes `costSummary` and a `finalizeCost` mutation; clearing the field reverts the
  line to estimate-only.
- History tab labels the new `cost_finalized` event.

Also fixed while here: the landed-cost table and the header totals referenced field names the RPC
never returned (`goods_cost_ils`, `allocated_overhead_ils`, `quantity`, …), so the tab rendered ₪0 in
every column. They now bind to the actual RPC output (`unit_purchase_cost_ils`,
`overhead_per_unit_ils`, `expected_landed_unit_cost_ils`, `expected_gross_profit_per_unit_ils`,
`expected_gross_margin_percent`, `ordered_quantity`).

---

## 6. Safety

- No Receiving logic, no write to `products.cost`, no inventory or `inventory_actions` mutation.
- Additive schema change only; no column dropped or renamed. Existing landed-cost values unchanged
  after backfill.
- RLS, tenant guards and grants unchanged; the two RPCs remain `authenticated`-only with
  `can_manage_business_imports` checks.
- Typecheck clean; production build successful (initial chunk unchanged at ~789 kB).

---

## 7. Phase 2 note

Landed cost is now unambiguous, so when Receiving writes a landed cost into `products.cost` it must
consume `effective_amount_ils` / `import_order_cost_summary`, and should require
`finalized_lines = lines` (or an explicit override) before treating the landed cost as final.

---

## FINAL VERDICT

**PASS — landed-cost policy unambiguous and safe for Phase 2.**

No blockers remain. Phase 2 Receiving is not started and awaits explicit approval.
