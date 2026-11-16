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
10. `docs/v2/return-reversal-guard.UNAPPLIED.sql` before `CUSTOMER_RETURN_READY`.
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

## Isolated verification before any production apply

Do not write to `zijzwvkpjaxvdbvpcfow` until that run is approved separately. The plan is the thirteen workflows in the task, using the disposable fixtures already on that project, without resetting Stage 9 rows and without using production credentials.
