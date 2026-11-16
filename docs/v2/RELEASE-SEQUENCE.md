# Production release sequence

Nothing in this file is applied by reading it. Writer flags stay false. Do not copy these files into `supabase/migrations`.

The live site is a separate publish. GitHub `main` does not update https://www.mlaiko.com until Lovable Share → Publish. The quantity lock stays unapplied until that published bundle no longer patches `products.quantity`.

## Already on production

Do not run these again:

- `docs/v2/production-upgrade/01_employees.additive.sql`
- `docs/v2/production-upgrade/02_sale_tables.additive.sql`
- `docs/v2/production-upgrade/03_sale_functions.additive.sql`
- `docs/v2/salesperson-required-a.additive.sql`
- `docs/v2/inventory-reversal.UNAPPLIED.sql` (applied once; the filename is historical)

## Do not apply

- `docs/v2/quick-sale-transaction.UNAPPLIED.sql`
- `docs/v2/employee-sales-attribution.UNAPPLIED.sql`
- `docs/v2/salesperson-required.UNAPPLIED.sql`
- `docs/v2/inventory-movement-balance.UNAPPLIED.sql`
- `docs/v2/products-quantity-update-lock.UNAPPLIED.sql` (isolated project only)

## Order when a later approval allows production SQL

1. Publish the client already on `main`. Confirm the live bundle calls `execute_inventory_transaction` and does not patch `products.quantity`. Flags stay false.
2. `docs/v2/products-quantity-update-lock.PRODUCTION.UNAPPLIED.sql`, in one transaction that sets `mlaiko.apply_quantity_lock` to `gtakgctmtayalcbpnryg`. It refuses any `isolated.project_ref`.
3. `docs/v2/legacy-sale-atomic.UNAPPLIED.sql`. Deploy the client with `LEGACY_SALE_ATOMIC_READY` only after this function exists.
4. `docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql` only after that atomic client is what production serves.
5. Turn `LEGACY_SALE_ATTRIBUTION_READY` on only after one active employee exists, then `docs/v2/salesperson-required-b.enforcement.sql`.
6. `docs/v2/sale-list-price-snapshot.UNAPPLIED.sql` immediately after step 5. Do not re-apply step 5 afterwards.
7. `docs/v2/preserve-unknown-cost.UNAPPLIED.sql` before `V2_SALES_STACK_READY`. It keeps a null purchase cost null inside `execute_inventory_transaction` and rejects a financial sale whose cost snapshot is null. Then `docs/v2/sale-known-cost-required.UNAPPLIED.sql`.
8. `docs/v2/sale-profit-reporting.UNAPPLIED.sql`, then `docs/v2/bi-insights-known-cost.UNAPPLIED.sql`.
9. `docs/v2/inventory-lifecycle.UNAPPLIED.sql`. Turn purchase, adjustment, supplier-return, and customer-return flags on one at a time only after their function is the one the deployed client calls.
10. `docs/v2/return-after-customer-return.UNAPPLIED.sql` before `CUSTOMER_RETURN_READY`. Do not apply `docs/v2/return-reversal-guard.UNAPPLIED.sql`. The new file adds triggers and does not replace `reverse_inventory_action` or `reverse_quick_sale`. A reversal after any customer return is rejected because those functions restore the whole movement. A partial reversal of only the outstanding units is not supported.
11. `docs/v2/purchase-order-receipts.UNAPPLIED.sql` before `PURCHASE_ORDERS_READY`. Do not also post the same receipt through `record_purchase_receipt`.
12. `docs/v2/supplier-return-dispatch.UNAPPLIED.sql` before `SUPPLIER_RETURN_DISPATCH_READY`. This path deducts once and does not reserve.
13. `docs/v2/supplier-return-reservation.UNAPPLIED.sql` after the quantity lock. `SUPPLIER_RETURN_RESERVATION_READY` stays false until sale writers are rejecting reserved units, which this file enforces with `quantity_reserved <= GREATEST(quantity, 0)`. Dispatch of a reservation is `dispatch_reserved_supplier_return` and must not be combined with step 12 for the same units.
14. `docs/v2/import-receipt-shortage-event.UNAPPLIED.sql` before partial import receiving is used. It only adds `receipt_shortage_recorded` and `receipt_overage_recorded` to the existing event check. It does not replace `import_receipt_confirm` and it does not apply the i2 schema.
15. `docs/v2/import-payment-method.UNAPPLIED.sql` before a client sends `payment_method` or `client_request_id`.
16. `docs/v2/employee-sales-report.UNAPPLIED.sql` after the sale tables. It is read-only. `can_access_business_analytics` is already on production. `V2_REPORTS_SQL_READY` stays false until the deployed client calls this function.
17. Set `V2_SALES_STACK_READY` only after steps 3, 5, 6, and 7.

Import shipment documents stay separate from `import_receipt_confirm`. The i2 import-upgrade files are not in this order. They are not required for the current import screens, and goods are still added only by the existing receipt confirmation.

## Rollback limits

- Dropping a function does not restore stock it already changed.
- Restoring table UPDATE on `products` reopens direct quantity edits.
- `salesperson-required.rollback.manual.sql` needs a separate approval and cannot invent an employee for a stored sale.
- The known-cost trigger can be dropped without rewriting existing null costs.
- A reservation that was already dispatched is not undone by dropping the reservation functions.
- Replacing `execute_inventory_transaction` does not rewrite stored costs. Restoring the old body makes the next adjustment of a null cost store 0.
- Dropping the return triggers lets a later reversal credit units that a customer return already restored.
- The import event check can be widened again. It cannot be narrowed while a `receipt_shortage_recorded` or `receipt_overage_recorded` row exists.

## Isolated verification, 2026-11-16

Local commits on `release/v2-ui`, not pushed. The first package commit is `e8373ed88bf9485726f7449487a468cc13e40aa9`. The follow-up commit records this evidence and removes a byte-order mark that stopped `bi-insights-known-cost.UNAPPLIED.sql`.

Target proven from the account project list and from queries sent only to that project: `zijzwvkpjaxvdbvpcfow`, name `mlaiko-isolated-tests`, region `ap-northeast-1`. Production `gtakgctmtayalcbpnryg` was read once, for the `inventory_actions` action-type checks. No production SQL was applied. Stage 9 product quantities were compared before and after every run and stayed unchanged, including sale quantity 6 and concurrent quantity 7.

### Applied on the isolated project

| File | SHA-256 | Result |
| --- | --- | --- |
| `docs/v2/user-businesses-insert-lock.UNAPPLIED.sql` | `e6d5a449d373098e0c6e44b5150f59a63c75f66ac16d0a3d2a980eef6b116613` | applied |
| `docs/v2/production-upgrade/01_employees.additive.sql` | `9dd61051d4912fb6953a2ba21f79050826f8c62cd6155953dfc86c9d7e34e2b2` | applied |
| `docs/v2/production-upgrade/02_sale_tables.additive.sql` | `d08f9122225a58c8be3e55ac1cdf4a39f783e3446f81f0fb79ff08ac2f99534a` | applied |
| `docs/v2/production-upgrade/03_sale_functions.additive.sql` | `bb14cc3bda8ebd6b83222ff3caf4fcba183bab51f5c06da7bedff5f3f33f3898` | applied |
| `docs/v2/salesperson-required-a.additive.sql` | `ebb99de1a97e0df93bd09aa7c9ad3e6c44b382df63167912a29608725ef24472` | applied |
| `docs/v2/legacy-sale-atomic.UNAPPLIED.sql` | `306f808bffd685612ed1f11fdc255b1f61cc638a34b042eccefd1d238af84420` | applied |
| `docs/v2/salesperson-required-b.enforcement.sql` | `d73249f3f8da0c4f77aa384882204feab9367e0c22a46fca2dd9b0c89f038fd8` | applied |
| `docs/v2/sale-list-price-snapshot.UNAPPLIED.sql` | `8bc6899bfacab0f62e57e1fe22cd82248777566357665421db57e03af2b6ac24` | applied |
| `docs/v2/sale-known-cost-required.UNAPPLIED.sql` | `414f2e863645cf707a1d71538bda4beed5b116d83bb87fff2018bf563bef309c` | applied |
| `docs/v2/sale-profit-reporting.UNAPPLIED.sql` | `24a57317ea40d5e014ab34454c52bf7c2d9f44324c493d36b5fcf8eb6664f2e5` | applied |
| `docs/v2/bi-insights-known-cost.UNAPPLIED.sql` | `0a8a2342ea1d437ab4a46e447fb147f873bcd4c17c3b6f0ca7a7e95504fb07ea` | applied after the byte-order mark was removed |
| `docs/v2/fifo-inventory-lots.UNAPPLIED.sql` | `2ca9bdef740a062f26559fdc4f0f3fae25f3bc497b8ee97766556778a1179591` | applied |
| `docs/v2/inventory-lifecycle.UNAPPLIED.sql` | `99c8daf54f1070ef80ce307b970c2ab315ee8d821c043971e772bee8e509900e` | applied |
| `docs/v2/purchase-order-receipts.UNAPPLIED.sql` | `8877d415d3760e7b6d895973104e3417efe7fcbcdedf017961ab0efafc704106` | applied |
| `docs/v2/supplier-return-dispatch.UNAPPLIED.sql` | `47554a67f239dbcd72024e40c7b22138455fa92a908fb2aa085eeb0007695f34` | applied |
| `docs/v2/supplier-return-reservation.UNAPPLIED.sql` | `df201ffc3bde449f6e5267d4e70eea6e20a621fb2e51b05b3238bd2f56b3639a` | applied |

Isolated-only adaptations, not copied into the production sequence:

- The isolated action-type check was widened to include `purchase`, which production already allows.
- `post_purchase_receipt` was granted to `authenticated` for this test. The prepared file still withholds that grant.
- `can_access_business_analytics` was installed from the existing migration `supabase/migrations/20260809091239_e21e7464-ac81-4e3a-84b1-197c7e037d8f.sql`. It is already required by the report function and was absent from the isolated schema.

Not applied: the production quantity lock, the isolated quantity lock (already present), `inventory-reversal.UNAPPLIED.sql` (already present), `return-reversal-guard.UNAPPLIED.sql`, the direct-write guard, and the i2 import-schema package.

`return-reversal-guard.UNAPPLIED.sql` was not applied because its `reverse_inventory_action` replacement drops the hardened authorization and negative-stock checks that are already on this database. Customer returns were tested without that replacement.

### Gap corrections, verified on the isolated project

These four files were applied only to `zijzwvkpjaxvdbvpcfow`. Production was read, not written.

| File | SHA-256 | Result |
| --- | --- | --- |
| `docs/v2/preserve-unknown-cost.UNAPPLIED.sql` | `da1451665cb6b6a86665b0638931464b6d523994e21e7d68d1cebc2bdf545676` | applied |
| `docs/v2/import-receipt-shortage-event.UNAPPLIED.sql` | `eca2af811bca285f5321302d063da8782268fca80a48c440e63fdf3faefb0a22` | applied |
| `docs/v2/return-after-customer-return.UNAPPLIED.sql` | `b8572d5a88e8df7ee51259e7ce8b5393bdeb93dfb7c42f02aac2b18c586a0835` | applied |
| `docs/v2/employee-sales-report.UNAPPLIED.sql` | `6d79352344d66d2ece1fb6f905e372a006a652e464706750e2ddde0e0cd00f66` | applied |

A product opened with a null cost stayed null through an adjustment and a purchase receipt. Both a quick sale and a legacy sale of that product were rejected with `known cost is required`, and the quantity stayed 7 with no sale row. An explicit cost of 0 stayed 0 and could be sold. A later explicit cost of 25 stayed 25 after another adjustment. A product opened at cost 10 stayed at 10 after an adjustment.

A partial import receipt of 2 from an order of 4 moved stock from 3 to 5, stored one `receipt_shortage_recorded` event, and left 2 outstanding. Confirming that receipt again did not add stock. The remaining 2 moved stock to 7 and left 0 outstanding. A separate full receipt of 3 moved stock from 1 to 4, and the second confirmation was rejected. Creating the order and setting the shipment status did not change stock.

A sale of 4 from quantity 10, followed by a return of 4, ended at 10. The following full reversal was rejected and the quantity stayed 10. The same return key replayed. A new return key was rejected. A return of 1 from another sale of 4 left quantity 7, and the full reversal was rejected. A reversal with no return restored the sold units once; the second call was rejected. A user from another business received 403.

For one dedicated business, the hand calculation was revenue 413 and ex-VAT profit 230 before considering the cancelled sale: employee A 295 and 170 across a mixed sale and a second sale, employee B 118 and 60. VAT was 63. After B was cancelled, the report was 295, profit 170, VAT 45, and B was absent. A legacy sale then brought the business to 413 and 230. Those figures matched the stored sale lines plus the legacy row. A customer return restored one unit and left revenue and profit at 413 and 230, with `customer_return_units` 1. A window two days earlier returned revenue 0 and profit null. The other business received 403. `reports_aggregate` gross profit for the same window was 230. Its `total_value` remains the older receipt figure and is not the profit result.

Production read: the purchase action type is already allowed, `can_access_business_analytics` already exists, and `post_purchase_receipt` already exists. `authenticated` does not have `EXECUTE` on that receipt function. The isolated test grant stays out of the production sequence.

A customer return does not reduce revenue. The return row records `financial_refund` false, so the original sale remains until a reversal. Reversal after a return is closed. Reversing only the units that were not returned is not available, because the current reversal functions restore the whole movement. Dropping the new triggers would reopen the double credit. Narrowing the import event check after a shortage event has been stored will fail while that row exists.
