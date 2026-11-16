# Production release sequence

Nothing in this file is applied by reading it. Writer flags stay false. Do not copy these files into `supabase/migrations`.

GitHub `main` is `9b1431dafd9ee9bbcdf3be6e1040d1ed36a3be6c`. Lovable has not published that commit. The last observed live bundle was `index-Cpjp56DM.js`, the client before the salesperson commit. The quantity lock stays unapplied. While both sale flags are false, the product editor sells through `execute_inventory_transaction` and does not send a salesperson. It calls `record_legacy_sale` only after `LEGACY_SALE_ATOMIC_READY` is true, and it refuses the sale if attribution is turned on first.

The final release is one cutover after a confirmed backup. This file does not turn flags on. Confirm Supabase PITR, or a fresh backup, for `gtakgctmtayalcbpnryg` before the first production SQL. Stop if that backup cannot be shown. There is no service worker. An installed home-screen icon loads the new bundle on the next open. `?ui=legacy` remains available. Do not change the domain or environment variables.

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

## Staged activation

Each stage is one approval. Stop at the first failed check. Do not combine stages. Flags change only in a published bundle, after the function they call already exists. `V2_UI_DEFAULT_ENABLED` stays false until the last stage. `v2DefaultSwitchReady` is the checklist for a later edit of that constant. `?ui=v2` stays the opt-in.

Historical editor sales use `reference_type = editor_operation`. `employee_sales_report` counts `legacy_sale_request` and quick-sale lines only. Do not replace the dashboard reader with that function until the sales being ranked were written by `record_legacy_sale` or `complete_quick_sale`.

0. Publish the compatibility client with every writer flag false. Verify the live bundle still calls `execute_inventory_transaction` for a sale, omits `products.quantity`, and contains `resolveLegacySaleWrite` only as source, not as a changed live sale. Stop if the bundle patches quantity or sends `p_salesperson_employee_id` to `execute_inventory_transaction`.
1. `docs/v2/products-quantity-update-lock.PRODUCTION.UNAPPLIED.sql`. Set `mlaiko.apply_quantity_lock` to `gtakgctmtayalcbpnryg` in that transaction. Stop if the session is not that project, or if the published bundle updates `products.quantity`. Verify `has_column_privilege(authenticated, products.quantity, UPDATE)` is false and a metadata update still succeeds in a reviewed statement that is rolled back, or by a non-writing privilege read.
2. `docs/v2/user-businesses-insert-lock.UNAPPLIED.sql`, alone. The file has no project-ref gate. Stop unless the session is proven to be `gtakgctmtayalcbpnryg`. Signup must still reach `create_business_for_new_user`. Stop if that function is not postgres-owned `SECURITY DEFINER`.
3. `docs/v2/preserve-unknown-cost.UNAPPLIED.sql`, then `docs/v2/sale-known-cost-required.UNAPPLIED.sql`. Stop if `execute_inventory_transaction` already contains `salesperson_employee_id`. A null receipt stays null. An explicit 0 stays 0. A sale with a null cost snapshot is rejected and changes no stock.
4. `docs/v2/legacy-sale-atomic.UNAPPLIED.sql`. Confirm `record_legacy_sale(uuid,uuid,integer,numeric,uuid,text,uuid)` exists. Then set `LEGACY_SALE_ATOMIC_READY` true and publish. Stop if the live editor still calls `execute_inventory_transaction` for a quantity decrease. Purchases and count corrections stay on that function.
5. `docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql` only after stage 4 is the bundle production serves. It blocks a browser quantity decrease. It does not block `execute_inventory_transaction`, so it is not a substitute for stage 7.
6. Confirm one active employee in the business that will sell. Then set `LEGACY_SALE_ATTRIBUTION_READY` true and publish. The sale dialog requires that employee and `record_legacy_sale` receives the id. Stop if the published bundle can still save a sale with no employee.
7. `docs/v2/salesperson-required-b.enforcement.sql`. Stop if any `sale_transactions.salesperson_employee_id` is null, or if the published editor still sells through `execute_inventory_transaction`. A cached page then fails closed with `salesperson is required` and does not deduct stock. Do not backfill old sales.
8. `docs/v2/sale-list-price-snapshot.UNAPPLIED.sql` immediately after stage 7. Do not re-apply stage 7 afterwards. It replaces `complete_quick_sale` and still requires the salesperson.
9. `docs/v2/sale-profit-reporting.UNAPPLIED.sql`, then `docs/v2/bi-insights-known-cost.UNAPPLIED.sql`. Profit stays ex-VAT and unknown cost stays out of profit. `reports_aggregate` is not the V2 profit source.
10. `docs/v2/inventory-lifecycle.UNAPPLIED.sql`. Then `STOCK_ADJUSTMENT_RPC_READY` only, so count corrections call `record_stock_adjustment`. Do not enable `PURCHASE_RECEIPT_ATOMIC_READY` here. Do not enable `SUPPLIER_RETURN_READY`. Leave customer returns for stage 11.
11. `docs/v2/return-after-customer-return.UNAPPLIED.sql`, then `CUSTOMER_RETURN_READY` so the client calls `record_customer_return`. Do not apply `docs/v2/return-reversal-guard.UNAPPLIED.sql`. A full reversal after any customer return stays rejected. There is no partial reversal and no monetary refund.
12. `docs/v2/purchase-order-receipts.UNAPPLIED.sql`, then `docs/v2/purchase-receipt-grant.UNAPPLIED.sql`. The first file leaves `post_purchase_receipt` without EXECUTE. The grant file does not replace the function. Then `PURCHASE_ORDERS_READY` and `PURCHASE_RECEIPT_ATOMIC_READY` together, so the receiving screen calls `post_purchase_receipt`. Do not also post those units through `record_purchase_receipt`. Direct product receiving stays a separate later flag.
13. `docs/v2/supplier-return-dispatch.UNAPPLIED.sql`, then `SUPPLIER_RETURN_DISPATCH_READY` so the client calls `confirm_supplier_return_dispatch`. This is the only supplier-return stock exit in the final release. It deducts once. Leave `SUPPLIER_RETURN_READY` and `SUPPLIER_RETURN_RESERVATION_READY` false. Do not apply `docs/v2/supplier-return-reservation.UNAPPLIED.sql` in this release. That path would deduct the same units a second time through `dispatch_reserved_supplier_return`.
14. `docs/v2/import-receipt-shortage-event.UNAPPLIED.sql` before a partial import receipt is confirmed. It adds `receipt_shortage_recorded` and `receipt_overage_recorded` to the existing check. It does not replace `import_receipt_confirm` and it does not apply the i2 schema. Documents and shipments still add no stock. Then `docs/v2/import-payment-method.UNAPPLIED.sql` before a client sends `payment_method` or `client_request_id`.
15. `docs/v2/employee-sales-report-history.UNAPPLIED.sql` instead of the earlier report file. It is read-only, granted to `authenticated`, and requires `can_access_business_analytics`. Historical `editor_operation` sales stay unattributed. `inventory_actions.user_id` is not an employee. Then `V2_REPORTS_SQL_READY` so the dashboard calls `employee_sales_report`. `reports_aggregate.total_value` is not gross profit. `FIFO_AGING_READY` stays false.
16. Set `V2_SALES_STACK_READY` only after stages 4, 7, 8, and 3. That one constant also turns on `QUICK_SALE_PERSISTENCE_READY` and `EMPLOYEE_SALES_ATTRIBUTION_READY`. The quick-sale screen then calls `complete_quick_sale` with one active employee.
17. Set `V2_UI_DEFAULT_ENABLED` true only when `v2DefaultSwitchReady` is true for the published flags and stages 1, 4, 6, and 7 have been verified on www.mlaiko.com. Publish that bundle. `?ui=legacy` remains the way back for one browser.

Import shipment documents stay separate from `import_receipt_confirm`. The i2 import-upgrade files are not in this order. They are not required for the current import screens, and goods are still added only by the existing receipt confirmation.

One Lovable publish happens after the SQL in this list has been applied and checked, and after a follow-up client commit turns on only the flags whose functions were just verified. That commit is not this one. Publish the existing project at `https://lovable.dev/projects/189c289a-9430-4114-9212-465332a6e893` with Share → Publish. Do not create a project, change the domain, or edit environment variables. Confirm the live bundle contains the approved SHA's sale routing and still has `V2_UI_DEFAULT_ENABLED` false until stage 17.

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
