# Phase 12 release gate

Feature flags stay off. Nothing in this file is applied by itself. Do not repeat `docs/v2/PHASE11C-readonly-preflight.sql`. The SQL Editor result below was checked manually.

## Verified production metadata

- `employees`: 3
- `sale_transactions`: 0
- `legacy_sale_request` movements: 0
- `customer_return` movements: 0
- `supplier_return` movements: 0
- Core V2 tables exist.
- `complete_quick_sale(uuid, uuid, uuid, text, jsonb)` and `reverse_quick_sale(uuid, uuid)` exist with those signatures.
- These were not found under the inspected signatures: `record_legacy_sale`, `record_purchase_receipt`, `record_customer_return`, `record_supplier_return`, `sale_cost_known`.
- `import_payments` exists. `payment_method` and `client_request_id` are absent.
- `check_sale_data` exists.

Static inspection and these metadata SELECTs do not prove transactional correctness. Replay, concurrency, stock locks, and rollback were not executed.

## A. Safe additive migrations

These add columns, indexes, or functions and do not replace a live writer.

- `docs/v2/sale-profit-reporting.UNAPPLIED.sql` adds `sale_cost_known` and replaces two report functions. It does not rewrite sale rows. Apply before the BI file.
- `docs/v2/bi-insights-known-cost.UNAPPLIED.sql` replaces two report functions and calls `sale_cost_known`.
- `docs/v2/inventory-lifecycle.UNAPPLIED.sql` adds four functions and four partial unique indexes. Current dialogs stay on their live path while the flags are false.
- `docs/v2/import-payment-method.UNAPPLIED.sql` adds nullable `payment_method` and `client_request_id`. The current form does not send them. Duplicate protection today is the pending button only.

## B. Migrations requiring a coordinated frontend deployment

- `docs/v2/legacy-sale-atomic.UNAPPLIED.sql`, then deploy the client that calls `record_legacy_sale`, then set `LEGACY_SALE_ATOMIC_READY`. This also replaces `check_sale_data`, which is required before any quick-sale flag.
- `docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql` only after that client is what production serves.
- `docs/v2/salesperson-required-b.enforcement.sql` only after the deployed client sends one active employee and no sale has a null salesperson. Current count of `sale_transactions` is 0.
- `docs/v2/sale-list-price-snapshot.UNAPPLIED.sql` immediately after B, and before `V2_SALES_STACK_READY`. The signature stays the same. The client already sends `unit_price_gross` and `list_unit_gross`. Do not re-apply B afterwards.
- `docs/v2/return-reversal-guard.UNAPPLIED.sql` before `CUSTOMER_RETURN_READY`. It replaces the two reversal functions and does not replace `complete_quick_sale`.

## C. Destructive or behavior-changing migrations

- Migration B rejects a new financial sale without an active salesperson and replaces `complete_quick_sale`.
- The direct-write guard blocks every browser stock decrease, including an old sale dialog.
- The list-price function rejects a client list price that does not match the locked catalog price. A null catalog price stores no discount. It does not rewrite historical rows.
- `legacy-sale-atomic` changes `check_sale_data`. A quick-sale stock row with null `sale_total_ils` fails that constraint until this file is applied.
- Report replacements change displayed profit. They do not rewrite rows.
- Do not run `docs/v2/inventory-movement-balance.UNAPPLIED.sql`. It raises and rolls back.
- Do not run `docs/v2/salesperson-required.UNAPPLIED.sql`. It raises on purpose.
- Rollback of B is `salesperson-required.rollback.manual.sql` and needs a separate approval. It cannot invent a salesperson for a row already stored.

## D. Database transaction tests that remain unverified

No isolated database was executed. These behaviors are specified in `docs/v2/PHASE11B-integration-tests.md` and are not proven by the metadata above:

- Atomic replay of the same idempotency key, including a different payload.
- Concurrent stock locks and an insufficient-stock rollback.
- Quick-sale confirmation that stores catalog list, charged price, and a null discount when the catalog price is null.
- Rejection of a client list price that is higher than the locked catalog price, with no stock change.
- Quick-sale reversal, including a second reversal that must not restore stock twice.
- Full reversal after a partial customer return.
- Purchase receipt with a null cost.
- Tenant rejection.
- Import payment unique `client_request_id`.
- SQL profit numbers after the report replacements.

## Release sequence

1. Keep the legacy sale dialog and purchase dialog on their current writes. Directory flag stays on. Every sales, receipt and return flag stays off.
2. Publish only an already approved client. A cached tab keeps the old write until the direct-write guard exists. There is no service worker.
3. Apply group B in the order in that section: atomic sale, its client, the direct-write guard, attribution flag, Migration B, then the list-price file.
4. Apply group A in the order in that section. Profit reporting can be applied before quick sales. BI only after `sale_cost_known`.
5. Apply the reversal guard before any customer-return flag.
6. Apply the import payment columns before any client sends `payment_method` or `client_request_id`.
7. Set `V2_SALES_STACK_READY` only after atomic sale, Migration B, and the list-price file. The reversal button then calls `reverse_quick_sale` for the last saved transaction only. There is no history of every quick sale.
8. Turn on purchase and return flags one at a time, only after their function exists and the deployed client calls it.

## Feature flags

`EMPLOYEES_DIRECTORY_READY` is true. `V2_SALES_STACK_READY`, `QUICK_SALE_PERSISTENCE_READY`, `EMPLOYEE_SALES_ATTRIBUTION_READY`, `LEGACY_SALE_ATTRIBUTION_READY`, `SALESPERSON_REPORT_READY`, `LEGACY_SALE_ATOMIC_READY`, `PURCHASE_RECEIPT_ATOMIC_READY`, `STOCK_ADJUSTMENT_RPC_READY`, `SUPPLIER_RETURN_READY`, and `CUSTOMER_RETURN_READY` stay false.

## Rollback limits

- Dropping a new function does not restore stock that the function already changed.
- Dropping the direct-write guard restores browser stock decreases, including old tabs.
- The list-price columns can be dropped only before a client writes them. Dropping them does not reconstruct historical discounts.
- Restoring the old report functions changes displayed profit again. It does not rewrite sale rows.
- A quick-sale reversal that already restored stock is not undone by restoring the previous function.
