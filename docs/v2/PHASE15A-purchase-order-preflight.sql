-- Read-only catalog preflight for the unapplied purchase-order migration.
-- Every statement below is a SELECT. This file does not call
-- save_purchase_order, post_purchase_receipt, or record_purchase_receipt.
-- A missing purchase object is the expected result before that migration.
-- Running this successfully does not mean the database is ready.

-- 1. Relations the migration reads or would create.
-- relkind r is an ordinary table. Any other relkind is a name conflict.
-- order_save rows are required before the migration.
-- receipt_only rows matter only before receipt execution is allowed.
-- created_by_order_migration rows are expected to be absent beforehand.
SELECT expected.name AS object_name,
       expected.needed_for,
       c.relkind,
       c.relrowsecurity,
       c.relforcerowsecurity,
       c.relacl::text AS raw_acl,
       c.oid IS NOT NULL AS present
FROM (VALUES
  ('businesses', 'order_save'),
  ('products', 'order_save'),
  ('suppliers', 'order_save'),
  ('employees', 'order_save'),
  ('inventory_actions', 'receipt_only'),
  ('inventory_lots', 'receipt_only'),
  ('inventory_lot_allocations', 'receipt_only'),
  ('purchase_orders', 'created_by_order_migration'),
  ('purchase_order_lines', 'created_by_order_migration'),
  ('purchase_receipts', 'created_by_order_migration'),
  ('purchase_receipt_lines', 'created_by_order_migration'),
  ('purchase_order_events', 'created_by_order_migration')
) AS expected(name, needed_for)
LEFT JOIN pg_class c
  ON c.relname = expected.name
 AND c.relnamespace = 'public'::regnamespace
ORDER BY expected.needed_for, expected.name;

-- 2. A type with the same name blocks a later table.
SELECT expected.name AS object_name,
       t.typtype,
       t.oid IS NOT NULL AS type_present
FROM (VALUES
  ('purchase_orders'),
  ('purchase_order_lines'),
  ('purchase_receipts'),
  ('purchase_receipt_lines'),
  ('purchase_order_events')
) AS expected(name)
LEFT JOIN pg_type t
  ON t.typname = expected.name
 AND t.typnamespace = 'public'::regnamespace
ORDER BY expected.name;

-- 3. Exact signatures. present = false is expected for the two new functions
-- and for the retired 7-argument save_purchase_order.
-- can_business_write and is_business_member must be present.
SELECT expected.needed_for,
       expected.signature,
       to_regprocedure(expected.signature) IS NOT NULL AS present
FROM (VALUES
  ('order_save', 'public.can_business_write(uuid)'),
  ('order_save', 'public.is_business_member(uuid,uuid)'),
  ('order_save', 'public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb,uuid,integer,date,text,text)'),
  ('retired_overload', 'public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb)'),
  ('receipt_only', 'public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)'),
  ('legacy_receipt', 'public.record_purchase_receipt(uuid,uuid,integer,uuid,numeric,uuid,text)')
) AS expected(needed_for, signature)
ORDER BY expected.needed_for, expected.signature;

-- 4. Every existing overload, including a signature the migration does not expect.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       p.proacl::text AS raw_acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'save_purchase_order',
    'post_purchase_receipt',
    'record_purchase_receipt',
    'can_business_write',
    'is_business_member'
  )
ORDER BY p.proname, identity_args;

-- 5. Execute rights of the named roles. A null oid skips the privilege lookup.
-- service_role true can mean that role bypasses checks; read raw_acl in query 4.
SELECT expected.signature,
       p.oid IS NOT NULL AS present,
       CASE WHEN p.oid IS NULL THEN NULL
            ELSE has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_execute,
       CASE WHEN p.oid IS NULL THEN NULL
            ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS authenticated_execute,
       CASE WHEN p.oid IS NULL THEN NULL
            ELSE has_function_privilege('service_role', p.oid, 'EXECUTE') END AS service_role_execute
FROM (VALUES
  ('public.can_business_write(uuid)'),
  ('public.is_business_member(uuid,uuid)'),
  ('public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb,uuid,integer,date,text,text)'),
  ('public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb)'),
  ('public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)'),
  ('public.record_purchase_receipt(uuid,uuid,integer,uuid,numeric,uuid,text)')
) AS expected(signature)
LEFT JOIN pg_proc p ON p.oid = to_regprocedure(expected.signature)
ORDER BY expected.signature;

-- 6. Table privileges for the five new relations. No row means the relation is absent.
SELECT c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') AS anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') AS anon_delete,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS authenticated_delete,
       c.relacl::text AS raw_acl
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'purchase_orders',
    'purchase_order_lines',
    'purchase_receipts',
    'purchase_receipt_lines',
    'purchase_order_events'
  )
ORDER BY c.relname;

-- 7. Policies. No row means those relations have no policies.
-- The migration would add one SELECT policy per table, using is_business_member.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    tablename IN (
      'purchase_orders',
      'purchase_order_lines',
      'purchase_receipts',
      'purchase_receipt_lines',
      'purchase_order_events'
    )
    OR policyname IN (
      'purchase_orders_read',
      'purchase_order_lines_read',
      'purchase_receipts_read',
      'purchase_receipt_lines_read',
      'purchase_order_events_read'
    )
  )
ORDER BY tablename, policyname;

-- 8. Columns the migration and the later receipt body require.
-- present = false on a created_by_order_migration column is expected beforehand.
-- present = false on an order_save column blocks the migration.
-- present = false on a receipt_only column blocks receipt execution only.
SELECT expected.needed_for,
       expected.table_name,
       expected.column_name,
       cols.data_type,
       cols.column_name IS NOT NULL AS present
FROM (VALUES
  ('order_save', 'businesses', 'id'),
  ('order_save', 'employees', 'id'),
  ('order_save', 'employees', 'business_id'),
  ('order_save', 'employees', 'display_name'),
  ('order_save', 'employees', 'is_active'),
  ('order_save', 'products', 'id'),
  ('order_save', 'products', 'business_id'),
  ('order_save', 'suppliers', 'id'),
  ('order_save', 'suppliers', 'business_id'),
  ('order_save', 'suppliers', 'name'),
  ('receipt_only', 'products', 'name'),
  ('receipt_only', 'products', 'quantity'),
  ('receipt_only', 'products', 'cost'),
  ('receipt_only', 'products', 'created_by'),
  ('receipt_only', 'products', 'updated_at'),
  ('receipt_only', 'inventory_actions', 'business_id'),
  ('receipt_only', 'inventory_actions', 'user_id'),
  ('receipt_only', 'inventory_actions', 'product_id'),
  ('receipt_only', 'inventory_actions', 'action_type'),
  ('receipt_only', 'inventory_actions', 'quantity_changed'),
  ('receipt_only', 'inventory_actions', 'currency'),
  ('receipt_only', 'inventory_actions', 'purchase_unit_ils'),
  ('receipt_only', 'inventory_actions', 'purchase_total_ils'),
  ('receipt_only', 'inventory_actions', 'supplier_id'),
  ('receipt_only', 'inventory_actions', 'notes'),
  ('receipt_only', 'inventory_actions', 'timestamp'),
  ('receipt_only', 'inventory_actions', 'source'),
  ('receipt_only', 'inventory_actions', 'reference_type'),
  ('receipt_only', 'inventory_actions', 'reference_id'),
  ('receipt_only', 'inventory_actions', 'is_reversal'),
  ('receipt_only', 'inventory_actions', 'reference_meta'),
  ('receipt_only', 'inventory_lots', 'business_id'),
  ('receipt_only', 'inventory_lots', 'product_id'),
  ('receipt_only', 'inventory_lots', 'received_at'),
  ('receipt_only', 'inventory_lots', 'original_quantity'),
  ('receipt_only', 'inventory_lots', 'remaining_quantity'),
  ('receipt_only', 'inventory_lots', 'unit_cost_ils'),
  ('receipt_only', 'inventory_lots', 'supplier_id'),
  ('receipt_only', 'inventory_lots', 'source_type'),
  ('receipt_only', 'inventory_lots', 'receipt_reference_type'),
  ('receipt_only', 'inventory_lots', 'receipt_reference_id'),
  ('created_by_order_migration', 'purchase_orders', 'id'),
  ('created_by_order_migration', 'purchase_orders', 'business_id'),
  ('created_by_order_migration', 'purchase_orders', 'supplier_id'),
  ('created_by_order_migration', 'purchase_orders', 'ordering_employee_id'),
  ('created_by_order_migration', 'purchase_orders', 'supplier_reference'),
  ('created_by_order_migration', 'purchase_orders', 'order_number'),
  ('created_by_order_migration', 'purchase_orders', 'ordered_on'),
  ('created_by_order_migration', 'purchase_orders', 'expected_on'),
  ('created_by_order_migration', 'purchase_orders', 'notes'),
  ('created_by_order_migration', 'purchase_orders', 'status'),
  ('created_by_order_migration', 'purchase_orders', 'completion'),
  ('created_by_order_migration', 'purchase_orders', 'close_reason'),
  ('created_by_order_migration', 'purchase_orders', 'idempotency_key'),
  ('created_by_order_migration', 'purchase_orders', 'last_request_key'),
  ('created_by_order_migration', 'purchase_orders', 'version'),
  ('created_by_order_migration', 'purchase_orders', 'created_by'),
  ('created_by_order_migration', 'purchase_orders', 'confirmed_by'),
  ('created_by_order_migration', 'purchase_orders', 'confirmed_at'),
  ('created_by_order_migration', 'purchase_orders', 'created_at'),
  ('created_by_order_migration', 'purchase_orders', 'updated_at'),
  ('created_by_order_migration', 'purchase_order_lines', 'id'),
  ('created_by_order_migration', 'purchase_order_lines', 'business_id'),
  ('created_by_order_migration', 'purchase_order_lines', 'purchase_order_id'),
  ('created_by_order_migration', 'purchase_order_lines', 'product_id'),
  ('created_by_order_migration', 'purchase_order_lines', 'brand'),
  ('created_by_order_migration', 'purchase_order_lines', 'model'),
  ('created_by_order_migration', 'purchase_order_lines', 'size_label'),
  ('created_by_order_migration', 'purchase_order_lines', 'load_index'),
  ('created_by_order_migration', 'purchase_order_lines', 'speed_rating'),
  ('created_by_order_migration', 'purchase_order_lines', 'supplier_sku'),
  ('created_by_order_migration', 'purchase_order_lines', 'barcode'),
  ('created_by_order_migration', 'purchase_order_lines', 'description'),
  ('created_by_order_migration', 'purchase_order_lines', 'ordered_qty'),
  ('created_by_order_migration', 'purchase_order_lines', 'received_qty'),
  ('created_by_order_migration', 'purchase_order_lines', 'agreed_unit_cost'),
  ('created_by_order_migration', 'purchase_receipts', 'id'),
  ('created_by_order_migration', 'purchase_receipts', 'business_id'),
  ('created_by_order_migration', 'purchase_receipts', 'purchase_order_id'),
  ('created_by_order_migration', 'purchase_receipts', 'receiving_employee_id'),
  ('created_by_order_migration', 'purchase_receipts', 'idempotency_key'),
  ('created_by_order_migration', 'purchase_receipts', 'received_at'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'business_id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'receipt_id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'purchase_order_line_id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'product_id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'quantity'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'agreed_unit_cost'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'actual_unit_cost'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'cost_ack_employee_id'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'cost_ack_at'),
  ('created_by_order_migration', 'purchase_receipt_lines', 'cost_reason'),
  ('created_by_order_migration', 'purchase_order_events', 'id'),
  ('created_by_order_migration', 'purchase_order_events', 'business_id'),
  ('created_by_order_migration', 'purchase_order_events', 'purchase_order_id'),
  ('created_by_order_migration', 'purchase_order_events', 'employee_id'),
  ('created_by_order_migration', 'purchase_order_events', 'event_type'),
  ('created_by_order_migration', 'purchase_order_events', 'detail'),
  ('created_by_order_migration', 'purchase_order_events', 'created_at')
) AS expected(needed_for, table_name, column_name)
LEFT JOIN information_schema.columns cols
  ON cols.table_schema = 'public'
 AND cols.table_name = expected.table_name
 AND cols.column_name = expected.column_name
ORDER BY expected.needed_for, expected.table_name, expected.column_name;

-- 9. Columns already stored on those names that the migration does not define.
-- A row here, while the table also lacks a column from query 8, is a shape conflict.
-- CREATE TABLE IF NOT EXISTS would leave that shape unchanged.
SELECT cols.table_name, cols.column_name, cols.data_type
FROM information_schema.columns cols
WHERE cols.table_schema = 'public'
  AND cols.table_name IN (
    'purchase_orders',
    'purchase_order_lines',
    'purchase_receipts',
    'purchase_receipt_lines',
    'purchase_order_events'
  )
  AND (cols.table_name, cols.column_name) NOT IN (
    SELECT expected.table_name, expected.column_name
    FROM (VALUES
      ('purchase_orders', 'id'),
      ('purchase_orders', 'business_id'),
      ('purchase_orders', 'supplier_id'),
      ('purchase_orders', 'ordering_employee_id'),
      ('purchase_orders', 'supplier_reference'),
      ('purchase_orders', 'order_number'),
      ('purchase_orders', 'ordered_on'),
      ('purchase_orders', 'expected_on'),
      ('purchase_orders', 'notes'),
      ('purchase_orders', 'status'),
      ('purchase_orders', 'completion'),
      ('purchase_orders', 'close_reason'),
      ('purchase_orders', 'idempotency_key'),
      ('purchase_orders', 'last_request_key'),
      ('purchase_orders', 'version'),
      ('purchase_orders', 'created_by'),
      ('purchase_orders', 'confirmed_by'),
      ('purchase_orders', 'confirmed_at'),
      ('purchase_orders', 'created_at'),
      ('purchase_orders', 'updated_at'),
      ('purchase_order_lines', 'id'),
      ('purchase_order_lines', 'business_id'),
      ('purchase_order_lines', 'purchase_order_id'),
      ('purchase_order_lines', 'product_id'),
      ('purchase_order_lines', 'brand'),
      ('purchase_order_lines', 'model'),
      ('purchase_order_lines', 'size_label'),
      ('purchase_order_lines', 'load_index'),
      ('purchase_order_lines', 'speed_rating'),
      ('purchase_order_lines', 'supplier_sku'),
      ('purchase_order_lines', 'barcode'),
      ('purchase_order_lines', 'description'),
      ('purchase_order_lines', 'ordered_qty'),
      ('purchase_order_lines', 'received_qty'),
      ('purchase_order_lines', 'agreed_unit_cost'),
      ('purchase_receipts', 'id'),
      ('purchase_receipts', 'business_id'),
      ('purchase_receipts', 'purchase_order_id'),
      ('purchase_receipts', 'receiving_employee_id'),
      ('purchase_receipts', 'idempotency_key'),
      ('purchase_receipts', 'received_at'),
      ('purchase_receipt_lines', 'id'),
      ('purchase_receipt_lines', 'business_id'),
      ('purchase_receipt_lines', 'receipt_id'),
      ('purchase_receipt_lines', 'purchase_order_line_id'),
      ('purchase_receipt_lines', 'product_id'),
      ('purchase_receipt_lines', 'quantity'),
      ('purchase_receipt_lines', 'agreed_unit_cost'),
      ('purchase_receipt_lines', 'actual_unit_cost'),
      ('purchase_receipt_lines', 'cost_ack_employee_id'),
      ('purchase_receipt_lines', 'cost_ack_at'),
      ('purchase_receipt_lines', 'cost_reason'),
      ('purchase_order_events', 'id'),
      ('purchase_order_events', 'business_id'),
      ('purchase_order_events', 'purchase_order_id'),
      ('purchase_order_events', 'employee_id'),
      ('purchase_order_events', 'event_type'),
      ('purchase_order_events', 'detail'),
      ('purchase_order_events', 'created_at')
    ) AS expected(table_name, column_name)
  )
ORDER BY cols.table_name, cols.column_name;

-- 10. Constraints and user triggers already attached to those names.
SELECT c.relname AS table_name,
       con.conname,
       con.contype
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'purchase_orders',
    'purchase_order_lines',
    'purchase_receipts',
    'purchase_receipt_lines',
    'purchase_order_events'
  )
ORDER BY c.relname, con.conname;

SELECT c.relname AS table_name, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relnamespace = 'public'::regnamespace
  AND NOT t.tgisinternal
  AND c.relname IN (
    'purchase_orders',
    'purchase_order_lines',
    'purchase_receipts',
    'purchase_receipt_lines',
    'purchase_order_events'
  )
ORDER BY c.relname, t.tgname;
