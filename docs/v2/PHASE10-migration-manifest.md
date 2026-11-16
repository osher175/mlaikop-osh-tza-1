# V2 migration manifest

Nothing in the prepared section has been applied by this phase. Applied files must not be run again.

## Already applied

| Order | File | Purpose | Do not |
| --- | --- | --- | --- |
| A1 | `docs/v2/production-upgrade/01_employees.additive.sql` | Employees table, owner writes, no delete | Re-run. It was verified. |
| A2 | `docs/v2/production-upgrade/02_sale_tables.additive.sql` | `sale_transactions` and `sale_lines` | Re-run. |
| A3 | `docs/v2/production-upgrade/03_sale_functions.additive.sql` | `complete_quick_sale`, `reverse_quick_sale` | Re-run. Quick-sale flag stays off. |
| A4 | `docs/v2/salesperson-required-a.additive.sql` | Nullable salesperson column, insert still allowed | Re-run. `attributed_actions` was 0. |

## Do not apply

| File | Why |
| --- | --- |
| `docs/v2/quick-sale-transaction.UNAPPLIED.sql` | Superseded by A2 and A3. A second apply fails. |
| `docs/v2/employee-sales-attribution.UNAPPLIED.sql` | Superseded. It would leave salesperson optional in the wrong shape. |
| `docs/v2/salesperson-required.UNAPPLIED.sql` | Raises on purpose. Use A4, then B. |
| `docs/v2/inventory-movement-balance.UNAPPLIED.sql` | Raises and rolls back. It must not backfill old balances. |
| `docs/v2/salesperson-required.rollback.manual.sql` | Recovery only, after a separate approval to undo B or an unused A. |

## Prepared order

Each file stays outside `supabase/migrations`. None of these flags is turned on by applying SQL.

### 1. Legacy atomic sale

- File: `docs/v2/legacy-sale-atomic.UNAPPLIED.sql`
- Purpose: one transaction for stock decrease and the legacy sale row. Replaces `check_sale_data` with a weaker check that allows a null cost and a quick-sale stock row.
- Prerequisites: A1–A4. Products, `inventory_actions`, `is_business_member`, `can_business_write`.
- Objects: unique index `uq_inventory_actions_legacy_sale_request`, function `record_legacy_sale`.
- Existing code: the dialog does not call it while `LEGACY_SALE_ATOMIC_READY` is false. Old pages keep the two-step write.
- Before frontend: yes. The function is unused until the client calls it.
- Flag: none at apply time. Set `LEGACY_SALE_ATOMIC_READY` only after the calling client is deployed.
- Rollback: drop the function and restore the previous `check_sale_data`. Do not drop it after new `legacy_sale_request` rows exist unless those rows are reviewed. Rows are not rewritten.
- Verify: function exists, owner is not `authenticated` or `anon`, a replay of the same key does not deduct twice.
- Hazard: apply this before enabling quick sales. The live `check_sale_data` rejects a stock row whose `sale_total_ils` is null.

### 2. Direct-write guard

- File: `docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql`
- Purpose: stop a cached page from decreasing stock or inserting `sale_total_ils` directly.
- Prerequisites: step 1 applied, and the deployed client calls `record_legacy_sale`. `complete_quick_sale`, `reverse_inventory_action`, and `execute_inventory_transaction` exist and are not owned by the browser role.
- Objects: two security-invoker triggers.
- Existing code: if applied earlier, every browser stock decrease fails, including the current sale dialog.
- Before frontend: no. Apply only after the atomic client is what production serves.
- Flag: the client flag must already be true. The guard is the database cutover. There is no service worker.
- Rollback: drop the two triggers. That restores the old browser write. It does not rewrite rows.
- Verify: a browser quantity decrease fails, and `record_legacy_sale` still decreases stock.

### 3. Legacy attribution, then Migration B

- Flag first: `LEGACY_SALE_ATTRIBUTION_READY`, only after one active employee exists. No SQL.
- File: `docs/v2/salesperson-required-b.enforcement.sql`
- Purpose: reject a new financial sale without an active salesperson. Replaces `complete_quick_sale`.
- Prerequisites: A4. The deployed client sends one active employee. No `sale_transactions` row has a null salesperson.
- Objects: salesperson trigger on insert and update, `sale_transactions.salesperson_employee_id` becomes not null, new `complete_quick_sale`.
- Existing code: an old tab that omits the employee can no longer complete a sale.
- Before frontend: no.
- Flag: attribution flag already true. Do not set `V2_SALES_STACK_READY` in the same step.
- Rollback: `salesperson-required.rollback.manual.sql` only under a separate approval. It cannot invent employees for rows already written.
- Verify: a null salesperson insert fails and rolls back the stock change. A reversal with no salesperson still succeeds.

### 3b. Quick-sale list price

- File: `docs/v2/sale-list-price-snapshot.UNAPPLIED.sql`
- Purpose: after Migration B, replace `complete_quick_sale` again. The locked `products.price` is the list snapshot. The charged price stays `unit_price_gross`. A client `list_unit_gross` that differs is rejected. A null catalog price stores a null discount.
- Prerequisites: step 3. Do not apply this file and then re-apply B.
- Objects: three nullable `sale_lines` columns, one check, the same `complete_quick_sale(uuid, uuid, uuid, text, jsonb)` signature.
- Existing code: the client already sends both prices. The deployed function ignores `list_unit_gross` until this file is applied. Existing rows are not updated.
- Before frontend: the current payload is compatible. Do not set `V2_SALES_STACK_READY` before this file, or a confirmed sale stores the charged price as the list price.
- Flag: none in this step.
- Rollback: restore the Migration B function body. Drop the three columns only before any row writes them.
- Verify: a raised client list price rolls back with no stock change. A null catalog price stores null list and null discount. Replay does not deduct again.

### 4. Sale profit reporting

- File: `docs/v2/sale-profit-reporting.UNAPPLIED.sql`
- Purpose: `reports_aggregate` and `yoy_financials` use the contract in `PHASE10-financial-contract.md`.
- Prerequisites: A2 so `sale_lines` exists. `yoy_financials` reads that table.
- Objects: `sale_cost_known`, replaced `reports_aggregate` and `yoy_financials`.
- Existing code: compatible. JSON keys stay the same. Displayed profit changes. Revenue stays VAT-inclusive.
- Before frontend: yes. No flag.
- Rollback: restore the previous function bodies from `supabase/migrations/20260809091239_...sql` and `20260809092436_...sql`. Rows are untouched.
- Verify: a null cost does not increase profit, and a quick-sale stock row is not added on top of its line.

### 5. BI and insights profit

- File: `docs/v2/bi-insights-known-cost.UNAPPLIED.sql`
- Purpose: the same profit rule in `bi_analytics_yearly` and `insights_aggregate`.
- Prerequisites: step 4, because it calls `sale_cost_known`.
- Objects: those two functions only.
- Existing code: revenue, purchases, discounts, and stock insights keep their filters. Profit numbers change. Dead-stock value is unchanged.
- Before frontend: yes. No flag.
- Rollback: restore `20260809094622_...sql` and `20260809101423_...sql`.
- Verify: a product with only unknown cost is absent from low-margin, and monthly gross profit is ex-VAT known cost.

### 6. Inventory lifecycle

- File: `docs/v2/inventory-lifecycle.UNAPPLIED.sql`
- Purpose: atomic purchase receipt, stock adjustment, supplier return, and customer partial return.
- Prerequisites: products, suppliers, `inventory_actions`, member and billing helpers.
- Objects: four functions and four partial unique indexes.
- Existing code: the client throws before the RPC while each flag is false. Current purchase and sale dialogs stay on their live path.
- Before frontend: yes.
- Flags, each only after this file is applied and the deployed client calls that function: `PURCHASE_RECEIPT_ATOMIC_READY`, `SUPPLIER_RETURN_READY`, `CUSTOMER_RETURN_READY`. `STOCK_ADJUSTMENT_RPC_READY` has no screen yet and stays false.
- Rollback: drop the four functions and indexes. Do not delete the movement rows they already wrote.
- Verify: replay returns the original row, a null purchase cost stays null, and a return does not set `reversed_at`.

### 7. Return and reversal guard

- File: `docs/v2/return-reversal-guard.UNAPPLIED.sql`
- Purpose: `reverse_inventory_action` and `reverse_quick_sale` reject a full reversal after any customer return, restocked or damaged.
- Prerequisites: safe before step 6, because no return rows exist yet. Apply it before turning `CUSTOMER_RETURN_READY` on.
- Objects: replaces those two functions. Does not replace `complete_quick_sale`, so it does not clash with Migration B.
- Existing code: today's undo still runs. With no return rows, the new check changes nothing.
- Before frontend: yes. The client also checks before calling the RPC.
- Flag: none. Turn on customer returns only after this file.
- Rollback: restore `20260720082218_...sql` and the `reverse_quick_sale` body from A3. That restores the double-restock hole.
- Verify: a return then a full reversal raises `full reversal is closed after a partial return` and leaves stock unchanged.

### 8. Import payment method

- File: `docs/v2/import-payment-method.UNAPPLIED.sql`
- Purpose: `payment_method` and a unique `client_request_id` on `import_payments`.
- Prerequisites: `import_payments` already exists.
- Objects: two nullable columns, one check, one partial unique index.
- Existing code: the form does not send the new columns. Sending them before this file makes the insert fail.
- Before frontend: yes. A later client must send `client_request_id` after the column exists. Until then, duplicate protection is the pending button only.
- Flag: none.
- Rollback: drop the index, check, and columns. Existing payment rows stay.
- Verify: two inserts with the same request id conflict, and a payment row does not change `products.quantity`.

### 9. Quick sales

- No further SQL. A3 is already applied.
- Set `V2_SALES_STACK_READY` only after steps 1, 3, and 3b. Step 1 is required so the first quick-sale stock row passes `check_sale_data`. Step 3 is required so the sale has an active salesperson. Step 3b is required so the list price is the catalog snapshot.
- The flag also opens employee attribution reads.

## Stale clients

There is no service worker. A cached bundle keeps its old writes until the direct-write guard is applied. A frontend flag does not make a sale atomic and does not stop an old tab.
