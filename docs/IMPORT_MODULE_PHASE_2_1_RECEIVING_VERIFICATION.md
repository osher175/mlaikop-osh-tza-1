# Import Module — Phase 2.1: Receiving Integrity Verification

Scope: verification (and minimal corrective fixes) of the Phase 2 Receiving flow now that it
can mutate production inventory. **Phase 3 (Import Closure / final landed-cost posting) is NOT
started.**

Method: full source review of the client path, plus inspection of the live database
definitions (functions, triggers, constraints, grants, RLS policies) in project
`gtakgctmtayalcbpnryg`. No production tenant data was mutated during verification.

---

## 1. Exact stock mutation path (single, verified)

```
ReceivingPanel (confirm dialog)
  → useImportReceiving.confirmReceipt
    → RPC import_receipt_confirm(p_receipt_id)            [SECURITY DEFINER, plpgsql]
      → per line: execute_inventory_transaction(...)      [canonical inventory RPC]
        → UPDATE products.quantity (+ rolling average cost)
        → INSERT inventory_actions (source/reference_type/reference_id)
      → UPDATE import_order_items.received_quantity
      → UPDATE import_receipt_items.applied_at
      → UPDATE import_orders status
      → INSERT import_events ('receipt_confirmed')
```

**No other client code path writes `products.quantity` for imports.** `saveDraft`,
`startReceiving`, `cancelDraft`, `resolveShortage` and `linkProduct` never touch stock.
Post-confirmation adjustments go only through `import_receipt_correct`, which itself calls
`execute_inventory_transaction`.

Verdict: single canonical mutation path — **PASS**.

## 2. Atomicity

`import_receipt_confirm` is one plpgsql function invoked as a single statement, therefore it
runs inside one database transaction. There is no exception handler swallowing errors: any
failure (unlinked product, tenant mismatch, permission denial, arithmetic error) aborts the
whole call and rolls back every line, the item counters, the receipt state and the event row.
Partial receipts are structurally impossible.

Verdict: **PASS**.

## 3. Idempotency / double-submit

`import_receipt_confirm` takes `SELECT ... FOR UPDATE` on the receipt row and then rejects any
status other than `draft`. A second concurrent call blocks on the row lock, then sees status
`confirmed` and raises. The UI additionally disables the button while pending. Receipt items
also carry a `UNIQUE (import_receipt_id, import_order_item_id)` constraint, so one line can
never be represented twice inside one receipt.

Verdict: **PASS**.

## 4. Draft isolation (drafts never move stock)

Confirmed by code: `import_receipt_save_draft` performs only INSERT/UPDATE/DELETE on
`import_receipt_items` plus an event row. `import_quantity_in_transit` counts only receipt
items with `applied_at IS NOT NULL`, so a draft is invisible to the in-transit read model and
to the inventory page.

Verdict: **PASS**.

## 5. Tenant isolation

* `import_receipt_start / save_draft / confirm / correct / cancel_draft` all resolve
  `auth.uid()` and fail closed via `can_manage_business_imports(business_id, uid)`.
* `execute_inventory_transaction` re-checks tenancy internally (Phase 0.5 hardening) — it does
  not trust its caller.
* Triggers `import_enforce_related_tenant` and `import_receipt_item_enforce_tenant` block any
  row that references a product, supplier or order belonging to another business.
* `import_receipt*` tables expose **SELECT-only** RLS policies; all writes must go through the
  audited RPCs.

Verdict: **PASS**.

## 6. In-transit correctness

`in_transit = GREATEST(ordered − confirmed_received − resolved_not_arriving, 0)`, computed
server side, page-bounded (max 100 product ids), quantities only — no cost, supplier or
freight data leaks to the inventory surface. Over-receipt cannot drive the value negative.

Verdict: **PASS**.

## 7. Product mapping mutability — **finding P1-B (FIXED)**

`import_order_items` carried a single `FOR ALL` RLS policy, so an import manager could
re-point `product_id` on a line that had **already been received**, silently detaching the
historical stock movement from the product it credited.

Fix applied (migration this phase): trigger `trg_import_items_lock_mapping` raises when
`product_id` changes on a line with `received_quantity > 0` or with any applied receipt item.
Mapping stays freely editable before the first receipt.

## 8. Draft line removal — **finding P1-A (FIXED)**

`import_receipt_save_draft` only upserted the submitted lines. The client sends only lines with
quantity > 0, so clearing a previously saved quantity back to 0 left the **old** quantity in the
database, and confirmation would have received goods the user had explicitly zeroed out.

Fix applied: the RPC is now authoritative — after upserting the payload it deletes every
non-applied line of that receipt that is absent from the payload. Zero-quantity lines are never
persisted.

## 9. Corrections after confirmation

`import_receipt_correct` never rewrites the original receipt line. It writes a new
`import_receipt_corrections` row and applies the delta through
`execute_inventory_transaction` (`add` for positive, `adjust` for negative, financially
neutral). Full ledger history is preserved.

Verdict: **PASS**.

## 10. Cost behaviour at receipt time (Phase 3 input)

At confirmation the unit cost passed to inventory is the **provisional goods cost only**
(expected ILS unit cost, or supplier unit cost × FX rate). Freight, customs, clearing and other
`import_costs` overheads are **not** included. Rolling average cost therefore currently
understates true landed cost between receipt and closure.

This is intentional for Phase 2 but is a hard requirement for Phase 3: closure must post a
**landed-cost adjustment** entry that reconciles received units to
`import_order_landed_cost`. Not a blocker for using Receiving today, but it must not be
forgotten.

## 11. Audit trail

Every meaningful step emits an `import_events` row (`receipt_started`, `receipt_draft_saved`,
`receipt_confirmed`, `receipt_corrected`, `shortage_resolved`) with `actor_user_id`, and every
stock movement writes `inventory_actions` with `source='import'`,
`reference_type='import_receipt'`/`'import_receipt_correction'` and the reference id.

Verdict: **PASS**.

## 12. UI safety

Mobile-first one-card-per-line layout; drafts explicitly labelled as not affecting stock;
confirmation requires an AlertDialog listing every line and the total units; lines with a
quantity but no linked product hard-block confirmation; over-receipt is warned, not silently
accepted; read-only users have every mutating control disabled.

Verdict: **PASS**.

---

## Residual notes (non-blocking)

1. **Landed cost not yet in inventory cost** — Phase 3 must close this (see §10).
2. Over-receipt is permitted by design (supplier over-shipment); it is visually flagged.
3. The pre-existing project-wide linter warnings (extension in public, SECURITY DEFINER
   functions executable by anon) are unchanged by this phase and are tracked separately.

---

## Final verdict

**PASS — Receiving integrity verified; safe to design Phase 3**

(two P1 findings were discovered during verification and fixed within this phase; the flow was
re-verified against the corrected definitions)
