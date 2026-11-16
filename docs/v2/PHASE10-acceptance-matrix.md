# Phase 11 acceptance matrix

Do not execute this matrix in Phase 10. Local means a running dev server against the already-applied production schema, with flags left off, and no new writes unless a later approval allows them. Controlled means a separately approved database where the named unapplied file has been applied.

| Area | Scenario | Where | Pass |
| --- | --- | --- | --- |
| Sales | Current sale dialog still writes only while the atomic flag is off | Local, read the flag and the dialog path | Flag false, no call to `record_legacy_sale` |
| Sales | Atomic sale commits stock and the movement together, and a repeated key does not deduct again | Controlled, after legacy-sale-atomic | One row, one quantity change |
| Sales | Metadata failure after an atomic sale does not look like a failed sale | Controlled | Stock and movement stay, dialog says the details were not saved |
| Purchases | Current purchase still uses the two-step write | Local | Purchase flag false |
| Purchases | Atomic receipt leaves unknown cost null and does not blend it with zero | Controlled, after inventory-lifecycle | Product cost stays null when the old cost was null and quantity was already positive |
| Inventory | Browser quantity decrease fails only after the direct-write guard | Controlled, after the guard and the atomic client | Trusted RPCs still adjust stock |
| Inventory | Import receipt increases stock through `execute_inventory_transaction` and does not insert `import_payments` | Local, read the receiving path | No payment row from a receipt |
| Employees | Directory flag is on and sales attribution flags are off | Local | Sale dialog does not query the roster |
| Employees | Performance shows a stored salesperson only, never `user_id` | Local while attribution flags are off | Panel stays unattributed |
| Journal | Purchases, supplier returns, and adjustments are not in the sale total | Local, classification code | Sale filter still requires a sale amount or a quick-sale stock row |
| Journal | A broad product search shows no partial list or partial money | Local | Empty state and partial label |
| Journal | Historical rows show balance unavailable | Local | No backfill |
| Returns | Return buttons stay disabled | Local | Both return flags false |
| Returns | Partial restock and damaged return do not set `reversed_at` and do not refund | Controlled, after lifecycle | Original sale remains |
| Returns | Full reversal after either return type does not restore more stock | Controlled, after the reversal guard | Error, stock unchanged |
| Import payments | Payment is linked to the open order and the selected supplier | Local, form payload | `import_order_id` and `payee_supplier_id` |
| Import payments | Paid rows accumulate. Planned, pending, and cancelled do not reduce the paid total | Local, cost step | Remaining uses paid `amount_ils` only |
| Import payments | A non-ILS payment without a rate cannot be saved | Local | Submit disabled |
| Import payments | Closure "שורות תשלום שטרם שולמו" is not the order balance | Local | Label matches the RPC, which sums non-paid payment rows |
| Import payments | Payment does not change stock and is not an expense line | Local | Separate from `import_costs` and products |
| Import payments | Same request id cannot insert twice | Controlled, after import-payment-method and a client that sends the id | Unique conflict |
| Reporting | V2 profit is ex-VAT and skips unknown cost, including historical 0 | Local, client math | Missing cost does not raise profit |
| Reporting | SQL reports still coalesce cost to 0 | Local, until steps 4 and 5 of the manifest | Document the difference. Do not treat live SQL profit as the new contract |
| Reporting | Prepared SQL profit matches the contract and does not double-count a quick sale | Controlled, after the two profit files | Line revenue once |
| Reporting | A truncated V2 or journal total is marked partial | Local, over the 20,000 cap or by reading the flag | Not shown as complete |
| Tenant | A member cannot read another business's employees, sales, payments, or movements | Controlled | RLS and the analytics guard reject it |
| Permissions | Employee writes stay owner-only. Import payments stay on the import permission | Local, read policies | No new grant |
| Duplicates | Legacy atomic key, lifecycle keys, and quick-sale key replay the first result | Controlled | No second stock change |
| Concurrency | Two reversals or a return plus a reversal lock the original row | Controlled | One stock outcome |
| Reversals | Undo of a normal sale still works when no customer return exists | Local, only with an approved write | Within 10 minutes |
| Failure | A failed RPC before its flag does not change stock | Local | Hebrew closed message, no request |
