-- PREPARATION ONLY. NOT EXECUTED. SELECTs ONLY.
-- Use ONLY after an approved application and with catalog visibility.
-- Does not invoke any business RPC, impersonate roles or run mutation tests.
-- Compare results with saved 02_preflight baseline; stop on unexplained drift.

SELECT count(*) AS products,
       count(*) FILTER (WHERE quantity < 0 OR reserved_quantity < 0 OR reserved_quantity > quantity) AS invalid_stock_rows,
       count(*) FILTER (WHERE reserved_quantity <> 0) AS nonzero_reserved_rows,
       count(*) FILTER (WHERE cost IS NULL) AS null_cost_products,
       count(*) FILTER (WHERE cost = 0) AS zero_cost_products,
       count(*) FILTER (WHERE price IS NULL) AS null_price_products
FROM public.products;
SELECT 'products_existing_fields' AS dataset, count(*) AS row_count,
       md5(COALESCE(string_agg(md5((to_jsonb(p) - 'reserved_quantity')::text), '' ORDER BY p.id), '')) AS fingerprint
FROM public.products p;
SELECT 'inventory_actions' AS dataset, count(*) AS row_count,
       md5(COALESCE(string_agg(md5(to_jsonb(ia)::text), '' ORDER BY ia.id), '')) AS fingerprint
FROM public.inventory_actions ia;

SELECT 'employees' AS relation, count(*) AS rows FROM public.employees
UNION ALL SELECT 'inventory_reservation_operations', count(*) FROM public.inventory_reservation_operations
UNION ALL SELECT 'inventory_reservations', count(*) FROM public.inventory_reservations;
-- All must be zero immediately after foundation application.

SELECT c.oid::regclass AS relation, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c WHERE c.oid IN
  ('public.employees'::regclass, 'public.inventory_reservation_operations'::regclass,
   'public.inventory_reservations'::regclass);
SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('employees', 'inventory_reservation_operations', 'inventory_reservations', 'products', 'inventory_actions')
ORDER BY tablename, policyname;

SELECT r.rolname, t.relation,
       has_table_privilege(r.oid, t.relation, 'SELECT') AS can_select,
       has_table_privilege(r.oid, t.relation, 'INSERT') AS table_insert,
       has_table_privilege(r.oid, t.relation, 'UPDATE') AS table_update,
       has_table_privilege(r.oid, t.relation, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, t.relation, 'TRUNCATE') AS can_truncate
FROM pg_roles r CROSS JOIN (VALUES ('public.employees'),
  ('public.inventory_reservation_operations'), ('public.inventory_reservations')) t(relation)
WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY t.relation, r.rolname;
-- authenticated: SELECT only on reservations/operations; employee INSERT/UPDATE
-- column grants below, not table-wide DML. anon: false throughout.
SELECT r.rolname, a.attrelid::regclass AS relation, a.attname,
       has_column_privilege(r.oid, a.attrelid, a.attname, 'INSERT') AS can_insert,
       has_column_privilege(r.oid, a.attrelid, a.attname, 'UPDATE') AS can_update
FROM pg_roles r CROSS JOIN pg_attribute a
WHERE r.rolname IN ('anon', 'authenticated') AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attrelid IN ('public.employees'::regclass,
    'public.inventory_reservation_operations'::regclass, 'public.inventory_reservations'::regclass)
ORDER BY relation::text, r.rolname, a.attnum;

SELECT c.conrelid::regclass AS relation, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
WHERE c.conrelid IN ('public.employees'::regclass,
  'public.inventory_reservation_operations'::regclass, 'public.inventory_reservations'::regclass)
  OR (c.conrelid = 'public.products'::regclass AND c.conname LIKE 'products_task1a_%')
ORDER BY relation::text, c.conname;
SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN
  ('employees', 'inventory_reservation_operations', 'inventory_reservations');
SELECT attname, format_type(atttypid, atttypmod) AS type, attnotnull
FROM pg_attribute WHERE attrelid = 'public.products'::regclass
  AND attname IN ('quantity', 'reserved_quantity', 'cost', 'price', 'available_quantity', 'latest_receipt_id')
  AND NOT attisdropped;

SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       p.oid::regprocedure AS function_signature, p.prosecdef, p.proconfig,
       pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgname LIKE 'trg_task1a_%' ORDER BY t.tgname;
-- All five Task 1A functions SECURITY INVOKER, locked search_path; anon and
-- authenticated direct EXECUTE false. Trigger execution still works normally.

SELECT p.oid::regprocedure AS signature, p.prosecdef, p.proconfig,
       pg_get_userbyid(p.proowner) AS owner, p.proacl,
       md5(pg_get_functiondef(p.oid)) AS definition_fingerprint,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('is_business_member', 'is_active_business_actor', 'can_business_write',
   'execute_inventory_transaction', 'reverse_inventory_action', 'reports_aggregate',
   'import_receipt_confirm', 'import_receipt_correct', 'import_order_close')
ORDER BY p.proname, p.oid;
-- Exact definitions, ownership, ACLs must match preflight; no existing RPC changed.

SELECT count(*) AS reservation_product_tenant_mismatches
FROM public.inventory_reservations r JOIN public.products p ON p.id = r.product_id
WHERE r.business_id IS DISTINCT FROM p.business_id;
SELECT count(*) AS reservation_operation_tenant_mismatches
FROM public.inventory_reservations r
JOIN public.inventory_reservation_operations o ON o.id = r.source_operation_id
WHERE r.business_id IS DISTINCT FROM o.business_id;
SELECT count(*) AS invalid_reservation_balances FROM public.inventory_reservations r
WHERE r.original_quantity <= 0 OR r.remaining_quantity < 0
  OR r.fulfilled_quantity < 0 OR r.released_quantity < 0
  OR r.original_quantity::bigint <> r.remaining_quantity::bigint
    + r.fulfilled_quantity::bigint + r.released_quantity::bigint;
SELECT count(*) AS product_reservation_sum_mismatches
FROM public.products p LEFT JOIN
  (SELECT business_id, product_id, sum(remaining_quantity::bigint) AS remaining
   FROM public.inventory_reservations GROUP BY business_id, product_id) r
ON r.business_id = p.business_id AND r.product_id = p.id
WHERE p.reserved_quantity::bigint <> COALESCE(r.remaining, 0);
-- Zero now. This query does not itself enforce synchronization for future writes.