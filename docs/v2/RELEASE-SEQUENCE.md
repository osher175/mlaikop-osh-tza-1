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
7. `docs/v2/sale-known-cost-required.UNAPPLIED.sql` before `V2_SALES_STACK_READY`.
8. `docs/v2/sale-profit-reporting.UNAPPLIED.sql`, then `docs/v2/bi-insights-known-cost.UNAPPLIED.sql`.
9. `docs/v2/inventory-lifecycle.UNAPPLIED.sql`. Turn purchase, adjustment, supplier-return, and customer-return flags on one at a time only after their function is the one the deployed client calls.
10. Do not apply `docs/v2/return-reversal-guard.UNAPPLIED.sql` as written. Its `reverse_inventory_action` replacement drops the hardened authorization and negative-stock checks. Customer returns can be posted by `record_customer_return` without that file. A reversal after a customer return still needs a separate patch that adds only the customer-return check to the hardened function.
11. `docs/v2/purchase-order-receipts.UNAPPLIED.sql` before `PURCHASE_ORDERS_READY`. Do not also post the same receipt through `record_purchase_receipt`.
12. `docs/v2/supplier-return-dispatch.UNAPPLIED.sql` before `SUPPLIER_RETURN_DISPATCH_READY`. This path deducts once and does not reserve.
13. `docs/v2/supplier-return-reservation.UNAPPLIED.sql` after the quantity lock. `SUPPLIER_RETURN_RESERVATION_READY` stays false until sale writers are rejecting reserved units, which this file enforces with `quantity_reserved <= GREATEST(quantity, 0)`. Dispatch of a reservation is `dispatch_reserved_supplier_return` and must not be combined with step 12 for the same units.
14. `docs/v2/import-payment-method.UNAPPLIED.sql` before a client sends `payment_method` or `client_request_id`.
15. Set `V2_SALES_STACK_READY` only after steps 3, 5, 6, and 7.

Import shipment documents stay separate from `import_receipt_confirm`. The i2 import-upgrade files are not in this order. They are not required for the current import screens, and goods are still added only by the existing receipt confirmation.

## Rollback limits

- Dropping a function does not restore stock it already changed.
- Restoring table UPDATE on `products` reopens direct quantity edits.
- `salesperson-required.rollback.manual.sql` needs a separate approval and cannot invent an employee for a stored sale.
- The known-cost trigger can be dropped without rewriting existing null costs.
- A reservation that was already dispatched is not undone by dropping the reservation functions.

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

### Known limitation

`create_product_with_opening_stock` stores a null cost, then the applied `execute_inventory_transaction` adjust path reads `COALESCE(cost, 0)` and writes that value back. A null opening cost therefore becomes 0. A product whose `cost` is actually NULL is rejected by `sale_lines_require_known_cost`, and the stock quantity does not change. Zero remains a known cost and can be sold.

A partial import receipt rolls back. `import_receipt_confirm` writes event type `receipt_shortage_recorded`, and `import_events` does not allow that type. A receipt for the full ordered quantity posts stock once. Confirming it again is rejected and does not post again.
