# Phase 11B integration tests

Do not run this file against production. Do not point it at the project id in `supabase/config.toml`. Every row below uses synthetic businesses, users, products, and payments created only in the isolated database.

The database session for each case is an authenticated user of business A, unless the case says otherwise. A second business, B, exists only for the isolation cases. No case reads or writes a real customer row.

## Schema order on a fresh database

1. Apply `supabase/migrations` in filename order. This is the historical schema. It does not create employees or sale tables.
2. Apply `docs/v2/production-upgrade/01_employees.additive.sql`.
3. Apply `docs/v2/production-upgrade/02_sale_tables.additive.sql`.
4. Apply `docs/v2/production-upgrade/03_sale_functions.additive.sql`.
5. Apply `docs/v2/salesperson-required-a.additive.sql`.
6. Seed the synthetic rows in the next section. Do not seed a quick sale yet.
7. Apply the prepared files in `PHASE10-migration-manifest.md` steps 1 through 8. Apply the direct-write guard only after the atomic-sale cases that still need the old two-step path have been recorded. Apply Migration B before any quick-sale case. Apply `bi-insights-known-cost` only after `sale-profit-reporting`.

Do not apply `quick-sale-transaction.UNAPPLIED.sql`, `employee-sales-attribution.UNAPPLIED.sql`, `salesperson-required.UNAPPLIED.sql`, or `inventory-movement-balance.UNAPPLIED.sql`.

## Synthetic seed

- User Owner A, member and owner of business A. Billing status `trial` or `active`.
- User Staff A, member of business A, not owner.
- User Owner B, owner of business B only.
- Product P1 in A, quantity 10, cost null.
- Product P2 in A, quantity 10, cost 0.
- Product P3 in A, quantity 4, cost 20.
- Supplier S1 in A.
- Employee E1 in A, active. Employee E2 in A, inactive.
- Import order O1 in A, supplier S1, one cost line of 100 ILS. No payment yet.
- Business B has its own product and no access to A.

## Cases

| Id | Case | Action | Pass |
| --- | --- | --- | --- |
| S1 | Atomic legacy sale | `record_legacy_sale` for P3, quantity 2, total 118, key K1, employee E1 | Quantity becomes 8. One sale row. `sale_total_ils` is 118. Cost snapshot is 20. |
| S2 | Unknown cost | Same function for P1, quantity 1, total 50, key K2, employee E1 | `cost_snapshot_ils` is null, not 0. |
| S3 | Real zero cost | Same function for P2, quantity 1, total 50, key K3, employee E1 | `cost_snapshot_ils` is 0. |
| S4 | Duplicate key | Call S1 again with K1 and a different quantity | Returns the original action. Quantity stays 8. |
| S5 | Concurrent sales | Two sessions sell the last units of a product with quantity 1, different keys | One commits. The other raises insufficient stock. Final quantity is 0. |
| S6 | Failed sale rolls back | Sell more units than stock | Exception. Quantity and movements unchanged. |
| Q1 | Quick sale | `complete_quick_sale` with two lines and one idempotency key, salesperson E1 | One transaction. Two lines. Two stock rows with null `sale_total_ils`. Revenue lives on the lines once. |
| Q2 | Duplicate quick sale | Repeat Q1 with the same key | `replayed` true. No second deduction. |
| Q3 | Quick-sale reversal | `reverse_quick_sale` once, then again | Stock restored once. Second call is `replayed` and does not add stock again. |
| P1 | Purchase receipt | `record_purchase_receipt` for P1, quantity 5, null unit cost, key R1 | Quantity increases by 5. Product cost stays null. One purchase row. |
| P2 | Duplicate receipt | Repeat P1 with R1 | No second increase. |
| C1 | Partial restock | After S1, `record_customer_return` for 1 unit, disposition `restock` | Quantity increases by 1. Original sale stays unreversed. No refund amount. |
| C2 | Damaged return | A second return of 1 unit, disposition `damaged` | Quantity unchanged. Both returns remain. |
| C3 | Over-return | Return more units than were sold | Exception. Stock unchanged. |
| U1 | Supplier return | `record_supplier_return` for P3, supplier S1, quantity 1 | Quantity decreases by 1. No `sale_total_ils`. |
| U2 | Full reversal after a return | `reverse_inventory_action` on the sale used in C1 | Error `full reversal is closed after a partial return`. Stock unchanged. |
| U3 | Reversal with no return | A new sale inside the 10-minute window, then `reverse_inventory_action` | Stock restored once. A second call fails as already reversed. |
| B1 | Balances | Read `reference_meta` on the purchase, supplier return, and customer return | `stock_before` and `stock_after` are integers and match the locked quantity. Older rows stay without a balance. |
| E1 | Attribution | Sale with E1 | `salesperson_employee_id` is E1. `user_id` is the signed-in user and is not copied into the salesperson. |
| E2 | Inactive employee | Sale with E2 | Rejected. Stock unchanged. |
| E3 | Missing employee after Migration B | Financial sale with null salesperson | Rejected. Stock unchanged. |
| I1 | Import payment | Insert a paid 40 ILS payment on O1 with request id D1, then the same D1 again | One row. The second insert conflicts. Product quantities unchanged. |
| I2 | Partial payments | Add a second paid 60 ILS payment with request id D2 | Paid total is 100. A planned row is not included in the paid total. |
| I3 | Foreign currency | Insert USD with no exchange rate | Rejected by the form rule. If inserted through SQL, do not treat `amount_ils` as correct unless a rate was stored. |
| F1 | Known profit | Call `reports_aggregate` for the S1 window | VAT-inclusive revenue includes 118. Gross profit uses 118/1.18 minus 40. The null-cost sale is in revenue and out of profit. |
| F2 | No double count | Include the Q1 window | Line revenue is counted once. The stock rows add nothing because `sale_total_ils` is null. |
| F3 | BI and insights | Call `bi_analytics_yearly` and `insights_aggregate` for the same year | Profit matches F1. A product whose only sales have null cost is absent from low-margin. |
| T1 | Tenant isolation | Owner B calls each RPC with business A | Access denied. No row in A changes. |
| T2 | Staff permission | Staff A writes an employee | Rejected. Staff A can still sell when the business can write. |
| R1 | Old browser path | After the direct-write guard, update `products.quantity` downward as `authenticated` | The update fails. A call to `record_legacy_sale` still succeeds. |

## Stop conditions

Stop the run if any case changes a business that was not created in this seed, if a replay deducts stock twice, or if a failed statement leaves a changed quantity.
