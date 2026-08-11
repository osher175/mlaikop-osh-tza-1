# Import Module — Phase 3: Import Closure & Final Cost Posting

Scope: controlled closure of an import order and posting of the final landed cost into the
**existing** Mlaiko costing model. No separate accounting engine was created, no sales history
was rewritten, and closure never touches stock quantities.

---

## 1. Current Mlaiko cost model — inspection findings

| Question | Finding |
| --- | --- |
| How is `products.cost` stored? | A single numeric column holding the **weighted moving-average unit cost** of the whole on-hand quantity. |
| How is rolling average computed? | Inside `execute_inventory_transaction`, only on `action_type='add'`: `new_cost = (qty_before × cost_before + qty_added × purchase_unit_ils) / qty_after`. `remove` and `adjust` leave cost untouched. |
| Do `inventory_actions` store cost snapshots? | Yes. `purchase_unit_ils` / `purchase_total_ils` for purchases, and **`cost_snapshot_ils` for sales** (`remove` is rejected without it). |
| Do sales carry a cost snapshot at sale time? | Yes — the sale row itself carries `cost_snapshot_ils`, captured from the product's average cost at the moment of the sale. |
| Does profit reporting use current cost or the snapshot? | `reports_aggregate` computes COGS as `SUM(cost_snapshot_ils × |qty|)` over sale rows — **sale-time snapshots**, never the current product cost. Changing `products.cost` therefore does **not** retroactively change reported historical profit. |
| Can past sale profitability be safely adjusted? | Only by rewriting `cost_snapshot_ils` on historical `inventory_actions`. There is **no audited COGS-restatement mechanism** in the system. Therefore historical sales are treated as immutable. |
| Existing canonical cost-adjustment path? | **None existed.** `execute_inventory_transaction` can only change cost as a side effect of a quantity change, which is unacceptable for a cost-only posting. Phase 3 introduces the missing path. |

## 2. Chosen final-cost policy

At closure, per import item with `received_quantity > 0`:

```
provisional_unit_cost = COALESCE(expected_unit_cost_ils, supplier_unit_cost × working_fx_rate)
overhead_per_unit     = SUM(import_costs.effective_amount_ils) / SUM(received_quantity)
final_unit_cost       = provisional_unit_cost + overhead_per_unit
unit_variance         = final_unit_cost − provisional_unit_cost  (= overhead_per_unit)
total_variance        = unit_variance × received_quantity
```

* `effective_amount_ils` (Phase 1.2) = final amount when finalized, otherwise the estimate — an
  estimate and its own final value are never summed.
* Allocation base is **confirmed received units only**. Draft receipts are excluded.
* Zero received units → `overhead_per_unit = 0` and no division is performed.

## 3. Posting into the weighted-average model

`products.cost = 227` is never assigned. The variance is capitalised only into units that are
**still on hand**, preserving weighted-average semantics:

```
qty_applied   = LEAST(received_quantity, quantity_on_hand_at_close)
applied_amount= unit_variance × qty_applied
new_cost      = cost_before + applied_amount / quantity_on_hand_at_close      (when on hand > 0)
unabsorbed    = unit_variance × (received_quantity − qty_applied)
```

Verified arithmetic (computed in Postgres, provisional ₪220, overhead ₪7/unit, 100 units):

| Scenario | Cost after receiving | On hand at close | Applied | Unabsorbed | Final `products.cost` |
| --- | --- | --- | --- | --- | --- |
| No old stock, nothing sold | 220.0000 | 100 | ₪700 | ₪0 | **227.0000** |
| 20 old @₪200 + 100 imported | 216.6667 | 120 | ₪700 | ₪0 | **222.5000** |
| 20 old + 100 imported, 20 sold | 216.6667 | 100 | ₪700 | ₪0 | **223.6667** |
| All 100 imported units sold | 220.0000 | 0 | ₪0 | ₪700 | **220.0000** (unchanged) |
| Final cost lower (−₪5/unit) | 216.6667 | 120 | −₪500 | ₪0 | **212.5000** |

## 4. Sold-before-finalization policy

**Historical sales are never modified.** Their `cost_snapshot_ils` — the only figure profit
reporting consumes — stays exactly as recorded, so past reports remain reproducible.

The portion of the variance attributable to units already sold is recorded as
`unabsorbed_amount_ils` in the adjustment ledger, keeping the money fully auditable without
silently restating history.

**Documented limitation:** because Mlaiko uses a single weighted-average cost per product, it is
impossible to know whether the specific units sold came from the old stock or from this import.
`qty_applied = LEAST(received, on_hand)` is the least misleading approximation: it capitalises
as much of the variance as the remaining stock can carry and explicitly discloses the rest. No
FIFO/LIFO layer was invented.

## 5. Cost adjustment ledger

New table `public.import_cost_adjustments` — immutable (a `BEFORE UPDATE OR DELETE` trigger
raises, and only `SELECT` is granted to `authenticated`):

`business_id, import_order_id, import_order_item_id, product_id, received_quantity,
provisional_unit_cost_ils, final_unit_cost_ils, unit_variance_ils, total_variance_ils,
quantity_on_hand_at_close, quantity_applied, applied_amount_ils, unabsorbed_amount_ils,
product_cost_before_ils, product_cost_after_ils, actor_user_id, reason, created_at`

No cost change is ever made without a matching ledger row in the same transaction.

## 6. Schema / RPC changes

* `import_cost_adjustments` (table + RLS SELECT policy + immutability trigger + unique index
  `(import_order_id, import_order_item_id)`).
* `import_closure_readiness(uuid) → jsonb` — checklist + per-item final-cost preview
  (provisional, final, variance, on hand, gross profit, gross margin %).
* `import_order_close(uuid, uuid pin_token, jsonb price_updates) → jsonb` — the single closure
  path.
* `import_order_summary(uuid) → jsonb` — the closed-import summary read model.
* Frontend: `useImportClosure`, `ClosurePanel`, new "סגירת יבוא" tab; `useImportPin` now exposes
  the opaque unlock token; the manual status dropdown can no longer set `completed`.

## 7. Idempotency

Three independent structural barriers, all inside one transaction:

1. `SELECT ... FOR UPDATE` on the import order — concurrent closures serialise.
2. Status guard: `completed` / `cancelled` raises `55000`.
3. `UNIQUE (import_order_id, import_order_item_id)` on the ledger, plus an explicit
   "adjustment already exists" guard.

Double click, two tabs, concurrent close and retry-after-timeout all converge on exactly one
posting: the second attempt aborts and rolls back entirely.

## 8. No quantity mutation

`import_order_close` contains no `INSERT INTO inventory_actions`, no call to
`execute_inventory_transaction`, and no write to `products.quantity`,
`import_order_items.received_quantity` or any receipt quantity. It writes `products.cost`
(and `products.price` only for explicitly ticked lines).

## 9. Security

* `auth.uid()` required; `can_manage_business_imports(business_id, uid)` enforced server side —
  the caller's claimed business is never trusted.
* Import step-up **PIN** must be unlocked when the business configured one; the RPC re-validates
  the opaque token server side (`import_pin_session_touch`).
* `EXECUTE` revoked from `PUBLIC`/`anon` on all three new RPCs; ledger is SELECT-only, tenant
  scoped.
* Cross-tenant closure is impossible: every read and write is filtered by the order's own
  `business_id`, and the product lock includes `business_id`.

## 10. Reopen policy

**Not supported in V1.** A completed import is locked for financial edits: the adjustment ledger
is immutable and no safe reversal mechanism exists (reversing a weighted-average revaluation
after further purchases/sales is not deterministic). The status dropdown can no longer be used
to set `completed`, and `import_receipt_confirm` already refuses closed orders.

## 11. Price handling

Existing product prices are **never** auto-updated. The closure screen shows final landed cost,
planned sale price, gross profit per unit and gross margin %, with an explicit per-line
checkbox "update to planned price". Each applied update emits a `sale_price_updated` event.

## 12. Margin alert

V1 threshold: **25%** (`MIN_GROSS_MARGIN_PERCENT`). Lines falling below it after final landed
cost are badged in red and summarised in a warning alert. No AI recommendation.

## 13. Audit events

`closure_started`, `final_cost_calculated`, `cost_adjustment_posted`, `sale_price_updated`
(per line, when applied), `import_closed` — all with actor and metadata, all additive.

## 14. Performance

Work is bounded by the closing order's item count: one indexed pass over its items, one locked
product row per item, one ledger insert per item. No catalogue-wide recalculation, no N+1 from
the client (readiness, ledger and summary are three server-side calls).

## 15. Tests

Arithmetic for the mandated scenarios was verified numerically in Postgres (table in §3):
equal cost, higher cost, lower cost, old stock + import, partially sold, fully sold, zero
remaining stock. Structural properties — multiple receipts, multiple items on one product,
overlapping imports, concurrent close, retry after timeout, cross-tenant refusal, employee
refusal, no quantity change, price unchanged unless explicit — are enforced by the code paths
described in §7–§11 and were verified by source/definition review.

**Limitation (honest):** this environment uses an external, unmanaged Supabase project and no
signed-in session can be minted, so `import_order_close` (which requires `auth.uid()`) could
**not** be executed end-to-end here. Authenticated runtime execution of the closure RPC is
therefore **UNVERIFIED** and should be exercised once on a real signed-in account before heavy
production use.

## 16. Known limitations & remaining risks

1. Weighted-average cannot attribute sold units to a specific import (see §4).
2. Overhead allocation is per-unit (V1), not by value or volume/weight.
3. Cost lines still in estimate at closure are locked in at their estimate — surfaced in the
   checklist as a warning.
4. No reopen / reversal in V1.
5. Authenticated end-to-end run of the closure RPC not executed in this environment.

---

## Final verdict

**CONDITIONAL PASS** — implementation, security and arithmetic are verified; the single
condition is one authenticated end-to-end closure run on a real account (not possible in this
environment).

* **Effect on `products.cost`:** the per-unit variance is capitalised only into units still on
  hand — `cost = cost_before + (unit_variance × qty_applied) / quantity_on_hand`. `products.cost`
  is never overwritten with the raw final landed cost.
* **Units sold before closure:** their share of the variance is *not* posted to product cost; it
  is recorded as `unabsorbed_amount_ils` in the immutable adjustment ledger.
* **Historical sales modified:** **No.** Sale-time `cost_snapshot_ils` values are untouched, so
  historical profit reports are unchanged.
* **Stock quantity changed by closing:** **No.** Closure is cost-only.
* **Cost posting idempotent:** **Yes** — order row lock + status guard + unique ledger index.
* **Import Module V1 functionally complete:** **Yes** — order → costs → receiving → in-transit →
  closure with final landed cost is end-to-end complete. Import analytics and reopen/reversal
  are deliberately out of V1.
