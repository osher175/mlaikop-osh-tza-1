# V2 production upgrade

Unapplied. Nothing in this directory is an approved migration, and none of it belongs in `supabase/migrations` until that copy is explicitly approved.

This package adds an employee directory and a multi-line sale. It does not rewrite products, legacy sales, prices, costs, or quantities.

## Do not apply

- `docs/v2/employee-sales-attribution.UNAPPLIED.sql` and `docs/v2/salesperson-required.UNAPPLIED.sql` — superseded. The ordered replacement is `salesperson-required-a.additive.sql`, then a frontend that sends the employee, then `salesperson-required-b.enforcement.sql`. None of those files is part of 01–03.
- `docs/v2/quick-sale-transaction.UNAPPLIED.sql` — superseded by files 02 and 03. Applying both stops because the objects already exist.
- `docs/task-1a/01_additive_foundation.proposed.sql` as part of this upgrade. It still changes product permissions and adds reservation tables. Employees are shared: if this package creates them first, Task 1A leaves that table alone.

## Order

1. Confirm the target project and that a usable backup or point-in-time recovery option exists.
2. Run `04_preflight.readonly.sql`. Keep the grid. Stop on any `block`.
3. `01_employees.additive.sql`
4. `02_sale_tables.additive.sql`
5. `03_sale_functions.additive.sql`
6. Run `05_verification.readonly.sql`. Product count, unit sum, and legacy sale count must match the preflight.
7. Regenerate `src/integrations/supabase/types.ts` from the updated project.
8. Only then change the three flags in `src/lib/v2/employeeAttribution.ts` to `true` in one change.

Files 01–03 each commit on success and roll back on failure. A lock wait longer than 5 seconds aborts file 02 without leaving a new sale table. The unique-key check can hold `products` and `inventory_actions` while it validates existing ids. It does not update those rows.

## What is new

- `public.employees`
- `public.sale_transactions`
- `public.sale_lines`
- `public.complete_quick_sale(uuid, uuid, uuid, text, jsonb)`
- `public.reverse_quick_sale(uuid, uuid)`
- `public.guard_quick_sale_movement()` and `trg_guard_quick_sale_movement`
- `public.task1a_employee_audit()` and its trigger, only when employees did not already exist
- Unique keys `products_business_id_id_key` and `inventory_actions_business_id_id_key`, only when a unique key on `(business_id, id)` is missing

`reverse_inventory_action` is not replaced. The new trigger rejects an update to `reversed_at` or `is_reversal` on a row whose `reference_type` is `sale_transaction`, unless `reverse_quick_sale` set the transaction-local flag. The legacy function’s quantity change then rolls back with that error. Rows that are not quick-sale movements are unchanged.

## Isolation

Employees are readable by a member of that business. Only `businesses.owner_id` can insert or update a name and active flag. There is no delete grant and no delete policy. A salesperson foreign key includes `business_id`, so an employee from another business cannot be stored. A null salesperson is an explicit unattributed sale.

Sale rows are readable by a member. Authenticated users cannot insert them. `complete_quick_sale` checks `is_business_member` and `can_business_write`, then checks that a named salesperson is an active employee of that business. Stock is locked in product-id order, checked again, and deducted in the same transaction. The movement is written with `sale_total_ils` left null and `reference_type = 'sale_transaction'`.

`reverse_quick_sale` uses the same membership and billing-write checks, and then allows the person who recorded the sale, `businesses.owner_id`, or a `business_users` row with role `owner` or `admin`. It does not grant a platform admin a cross-business reversal. A repeated call after the sale is already reversed returns the same id and does not restore stock again.

## Money

VAT is 18 percent, the same rate as `src/lib/financialConfig.ts`. Line gross is `round(unit price × quantity, 2)`. Transaction net is `round(transaction gross / 1.18, 2)`, the same formula as the draft quote. Unknown `products.cost` is stored as null. A stored zero stays zero. Header `known_cost_ex_vat_ils` is null when every line cost is unknown, and is only a partial sum when some lines are unknown.

The dashboard and employee analytics keep using `src/lib/v2/dashboardMetrics.ts`. Legacy rows still come from `inventory_actions` where `sale_total_ils` is not null. New sales are appended from `sale_lines` only while `QUICK_SALE_PERSISTENCE_READY` is true. Those movements are not a second sale. Historical rows are not attributed and are not rewritten. A legacy zero cost remains unknown in that reporting path.

## Flags

Leave these false until verification has passed and types have been regenerated:

- `EMPLOYEES_DIRECTORY_READY`
- `QUICK_SALE_PERSISTENCE_READY`
- `EMPLOYEE_SALES_ATTRIBUTION_READY`

Turn all three on together. One flag alone would show a roster that cannot be saved, or a save button whose analytics path is still closed.

## Rollback

`06_rollback.manual.sql` is only for an unused upgrade: no employees, no sale rows, and no quick-sale movements. It refuses otherwise. It does not delete business data. If any sale or employee row exists, recovery is the database backup, not this script.

## Not in this package

Reservation balances. If `reserved_quantity` is later enforced, `complete_quick_sale` must be revised so a sale cannot consume reserved units. That revision is a separate approval. This function does not read that column, because it is not in the live database.
