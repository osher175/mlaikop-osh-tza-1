# I3 disposable database test plan

Do not create a database for this plan unless that environment is separately approved.
Do not point either SQL file at production. Apply `01-import-wizard-commit.UNAPPLIED.sql` only on the disposable database, after `02-preflight.readonly.sql` passes there.

## Setup

1. Run the read-only preflight. It must stop if supplier classification or `import_wizard_commit` already exists.
2. Apply `01-import-wizard-commit.UNAPPLIED.sql` on the disposable database only.
3. Run `03-disposable-checks.sql` with `i3.disposable_database = authorized`. That file rolls back its own session and refuses any other setting.

## Cases the checks cover

- New supplier columns default existing rows to local purchasing, and a supplier with both flags false is rejected.
- `import_wizard_commit` is invoker, executable by `authenticated` only, and its body does not update `products.quantity` or insert `inventory_actions`.
- The local-purchasing trigger function is not granted to `anon` or `authenticated`.
- Tire identity rejects two rows with the same business identity key, and two rows with the same business SKU.
- An identity row whose product belongs to another business is rejected.

## Cases to run with two disposable users after the checks

Use two businesses, A and B. Do not reuse production ids.

1. Existing suppliers in A remain `serves_local = true` and `serves_import = false`. The local purchasing picker includes them. The import wizard does not.
2. A new import supplier is `serves_import = true` and `serves_local = false`. It is absent from local purchasing. An `inventory_actions` insert that names it fails, and no quantity changes.
3. Mark one supplier with both flags. It appears in both pickers. The import function accepts it. A local stock insert accepts it.
4. Pass a local-only supplier id to `import_wizard_commit`. The function raises, and no order, product, or stock row remains.
5. Submit one request id twice with the same payload. The second call returns the same order id and does not add lines.
6. Submit the same request id with a different payload. The function raises and does not create a second order.
7. Select an existing product id. The order line uses that id. `products.quantity`, `price`, and `cost` are unchanged. No `inventory_actions` row is created.
8. Define a new tire. The new product quantity is 0, price and cost are null, and no `inventory_actions` row is created. A low-stock notification may still be inserted by the existing product notification trigger. That notification is not a stock movement. Record whether it happened.
9. Repeat the same new tire from two concurrent sessions. One product row exists. The other session reuses it or rolls back. It must not leave two products.
10. Give the same SKU with a different brand, model, or size. The function raises. No second product remains.
11. Use the same size with a different brand and model and no SKU. A second product is created. Size alone does not merge.
12. A catalog product with no identity row is not reused from its name, barcode, or size text. If no single purchase-order line in the same business stores the same brand, model, size, load code, and speed code, the function creates a second product at quantity 0. Selecting the existing product id reuses it and does not change quantity.
12a. One purchase-order line stores that full identity on exactly one product in the business. The function reuses the product, inserts one identity row, and does not change quantity. A missing load or speed on the line is not a match. Two products with the same complete line raise `Ambiguous tire identity` and leave no new product.
13. Send a product id from business B while authenticated as A. The function raises and leaves no order.
14. Cancel the order, or receive the full outstanding quantity through the already applied receipt path. The catalog incoming calculation no longer includes it. Do not add a new receipt engine in this test.
15. Open two orders for one stocked product with two arrival dates. The catalog keeps the real quantity and shows the earlier date. A product with quantity 0 shows no quantity.

## Rollback limits

Dropping `import_wizard_commit` and `import_tire_identity` removes the new write path. Dropping `serves_import` after a supplier has been classified loses that classification. Orders created during the test stay until that disposable database is destroyed. There is no production rollback script in this folder, and these statements are not to be run on production.
