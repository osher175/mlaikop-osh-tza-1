# Fix: "record new has no field product_id" when creating an import order

## What's happening

Creating a new import order fails with `record "new" has no field "product_id"`.

The cause is confirmed in the database trigger function `import_enforce_related_tenant()`, which runs on inserts into `import_orders`. It uses one flat condition chain:

```text
ELSIF TG_TABLE_NAME = 'import_order_items' AND NEW.product_id IS NOT NULL THEN ...
```

PostgreSQL evaluates the whole condition as a single expression and does not guarantee left-to-right short-circuiting, so it tries to read `NEW.product_id` even when the row comes from `import_orders` — a table that has no such column. The insert aborts.

## The fix

One migration recreating `public.import_enforce_related_tenant()` with the table check and the column check split into nested blocks, so a column is only ever read for the table that actually has it:

```text
IF TG_TABLE_NAME = 'import_orders' THEN
   IF NEW.supplier_id IS NOT NULL THEN ... END IF;
ELSIF TG_TABLE_NAME = 'import_order_items' THEN
   IF NEW.product_id IS NOT NULL THEN ... END IF;
ELSIF ... (import_costs, import_payments the same way)
END IF;
```

All tenant-isolation rules stay exactly the same: an order's supplier, an item's product, a cost's service provider and a payment's payee must all belong to the same business. Nothing else changes — same function name, same signature, same `SECURITY DEFINER` and `search_path`, same triggers attached.

## Verification

- Recheck the function body after the migration.
- Confirm cross-tenant inserts still raise the expected errors.
- Create a new import order from the UI (the dialog in the screenshot) and confirm it saves.

No UI, RLS, billing or subscription code is touched.
