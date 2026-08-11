# Import Module — Phase 3.1: Authenticated Live Closure Smoke Test

Status: **NOT EXECUTED — BLOCKED**

## 1. What was attempted

The goal was one real authenticated end-to-end closure of an Import Order using the Phase 3
flow (`import_order_close`), with before/after capture, idempotency retry, authorization check
and UI regression pass.

Two independent blockers made the live run impossible in this environment. Neither is a defect
in the Phase 3 implementation.

## 2. Blocker A — no authenticated session can be minted

This project is connected to an **external, unmanaged Supabase project**
(`LOVABLE_BROWSER_AUTH_STATUS = external_unmanaged`). The preview sign-in bridge does not
inject a session for external projects, and no session can be created from this environment.

`import_order_close` is deliberately fail-closed on `auth.uid()`:

* `auth.uid()` must be non-null;
* `can_manage_business_imports(business_id, auth.uid())` must pass;
* the import PIN step-up token is re-validated server side.

The tooling available here executes SQL as `service_role`, where `auth.uid()` is `NULL`. Calling
the RPC from here therefore aborts at the authorization guard — which is the correct, designed
behavior, but it also means the closure path cannot be exercised end-to-end without a real
signed-in browser session.

**Side note (positive signal):** this is itself a partial confirmation of the Phase 3 security
requirement "Step-Up authorization is enforced server-side" — an unauthenticated privileged
caller cannot close an import.

## 3. Blocker B — no import data exists to close

Live counts at the time of the attempt:

| Table | Rows |
| --- | --- |
| `import_orders` | 0 |
| `import_order_items` | 0 |
| `import_receipts` | 0 |
| `import_receipts` (status = `confirmed`) | 0 |
| `import_costs` | 0 |
| `import_cost_adjustments` | 0 |
| `import_pin_settings` | 0 |

There is no import order anywhere in the database — closable or otherwise — and no business has
configured an import PIN. The tenants that do exist are real business tenants
(6 businesses, 720 products, 3,785 inventory actions); none of them is a designated test tenant,
and the brief explicitly requires "a safe test tenant/order where inventory impact is
understood".

Manufacturing the required fixture from here would mean writing import orders, receipts,
confirmed receiving and cost lines into a live tenant as `service_role`, bypassing the very RLS
and step-up guards the test is meant to validate. That would produce a test of the seeding
script rather than of the product flow, so it was not done.

## 4. Verification checklist — current state

| Check | Result |
| --- | --- |
| Order becomes `completed` | NOT VERIFIED (blocked) |
| Product quantity unchanged | NOT VERIFIED at runtime; structurally guaranteed (Phase 3 §8: no quantity writes in the RPC) |
| Final landed cost calculated correctly | Arithmetic verified numerically in Postgres in Phase 3 §3; not verified through the RPC |
| `products.cost` follows the weighted-average formula | Same as above |
| Exactly one immutable ledger entry | NOT VERIFIED at runtime; enforced by `UNIQUE (import_order_id, import_order_item_id)` + immutability trigger |
| Sale cost snapshots unchanged | NOT VERIFIED at runtime; the RPC contains no write to `inventory_actions` |
| Sold-unit variance recorded as `unabsorbed_amount_ils` | NOT VERIFIED at runtime |
| No duplicate quantity movement / unintended inventory action | NOT VERIFIED at runtime; no `inventory_actions` insert exists in the closure path |
| Audit events written | NOT VERIFIED at runtime |
| Step-up authorization enforced server side | PARTIALLY VERIFIED — an unauthenticated `service_role` caller is rejected by the `auth.uid()` guard |
| Idempotency retry rejected | NOT VERIFIED at runtime |
| UI regression pass | NOT VERIFIED — requires a signed-in session |

## 5. Fixes applied

None. No bug was exposed, because the flow could not be exercised. No business logic was
changed in this phase.

## 6. How to unblock

Either of the following makes the live smoke test executable:

1. **Run it manually** on a real signed-in owner/import-manager account against a disposable
   test business: create an import order with one item mapped to a product with known values,
   confirm a receipt, finalize the cost lines, then close. Report the before/after values and
   this document can be completed from them.
2. **Provide a test tenant + credentials** (or move the project to Lovable Cloud, where a
   browser session can be injected) and the full authenticated run — including the idempotency
   retry and UI regression pass — can be driven from here with Playwright.

The deterministic example from the brief (100 units on hand, average cost ₪220, +₪700 variance
to absorb → expected cost ₪227.0000, `unabsorbed_amount_ils` ₪0) is the recommended fixture; its
expected values are already tabulated in `docs/IMPORT_MODULE_PHASE_3_CLOSURE_FINAL_COST.md` §3.

---

## Final verdict

**Neither PASS nor FAIL can be issued.** The mandated verdict strings both assert that a live
closure was executed; it was not. The honest status is:

**BLOCKED — live authenticated closure not executed (no authenticated session available in this
environment, and no import order data exists to close).**

Phase 3 remains at its prior verdict: CONDITIONAL PASS, pending exactly this test.
