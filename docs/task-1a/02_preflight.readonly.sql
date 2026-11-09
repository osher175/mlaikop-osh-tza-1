-- PREPARATION ONLY. NOT EXECUTED. READ-ONLY SELECTs ONLY.
-- Run only after explicit approval, with catalog visibility (prefer postgres).
-- Save ALL result sets securely as baseline before any approved migration.
-- No JWT/session mutation, SET ROLE, business RPC execution or SQL writes.
-- Statically checked against repository history; NOT production-verified.
-- Run dependency inventory below FIRST. Stop before dependent statements if
-- any relation/column is absent. user_businesses creation DDL is missing from
-- local migrations; types.ts and later ALTER/helpers are NOT creation proof.
SELECT d.relation, d.column_name, to_regclass(d.relation) AS relation_oid,
       EXISTS (SELECT 1 FROM pg_attribute a
         WHERE a.attrelid = to_regclass(d.relation) AND a.attname = d.column_name
           AND a.attnum > 0 AND NOT a.attisdropped) AS column_exists
FROM (VALUES
  ('public.products', 'id'), ('public.products', 'quantity'),
  ('public.products', 'cost'), ('public.products', 'price'), ('public.products', 'business_id'),
  ('public.inventory_actions', 'id'), ('public.inventory_actions', 'product_id'),
  ('public.inventory_actions', 'business_id'), ('public.business_users', 'status'),
  ('public.business_users', 'user_id'), ('public.business_users', 'business_id'),
  ('public.business_users', 'role'), ('public.user_businesses', 'user_id'),
  ('public.user_businesses', 'business_id'), ('public.user_businesses', 'role'),
  ('public.businesses', 'id'), ('public.businesses', 'owner_id'), ('public.profiles', 'id'),
  ('public.user_roles', 'user_id'), ('public.user_roles', 'role')
) d(relation, column_name);
-- Supabase API roles must also exist before has_*_privilege(name, ...) calls.
SELECT name, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = name) AS role_exists
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(name);

SELECT version() AS postgres_version, current_user AS inspection_role,
       now() AS captured_at, current_database() AS database_name;

SELECT count(*) AS total_products,
       count(*) FILTER (WHERE quantity < 0) AS negative_quantity_products,
       count(*) FILTER (WHERE quantity IS NULL) AS null_quantity_products,
       count(*) FILTER (WHERE quantity = 0) AS zero_quantity_products,
       count(*) FILTER (WHERE quantity > 0) AS positive_quantity_products,
       count(*) FILTER (WHERE cost IS NULL) AS null_cost_products,
       count(*) FILTER (WHERE cost = 0) AS zero_cost_products,
       count(*) FILTER (WHERE cost < 0) AS negative_cost_products,
       count(*) FILTER (WHERE price IS NULL) AS null_price_products
FROM public.products;

-- Baseline fingerprints: compare with verification at same write-quiescent
-- point. Normal concurrent business activity invalidates equality comparison.
SELECT 'products_existing_fields' AS dataset, count(*) AS row_count,
       md5(COALESCE(string_agg(md5((to_jsonb(p) - 'reserved_quantity')::text), '' ORDER BY p.id), '')) AS fingerprint
FROM public.products p;
SELECT 'inventory_actions' AS dataset, count(*) AS row_count,
       md5(COALESCE(string_agg(md5(to_jsonb(ia)::text), '' ORDER BY ia.id), '')) AS fingerprint
FROM public.inventory_actions ia;

SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS type,
       a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = 'public.products'::regclass AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT c.conrelid::regclass AS relation, c.conname, c.contype, c.convalidated,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid IN ('public.products'::regclass, 'public.inventory_actions'::regclass,
                    'public.business_users'::regclass, 'public.user_businesses'::regclass,
                    'public.profiles'::regclass)
ORDER BY c.conrelid::regclass::text, c.conname;

-- Incoming product references: identify existing CASCADE/SET NULL behavior.
SELECT c.conrelid::regclass AS child_relation, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'f' AND c.confrelid = 'public.products'::regclass
ORDER BY c.conrelid::regclass::text, c.conname;

SELECT c.oid::regclass AS relation, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c
WHERE c.oid IN ('public.products'::regclass, 'public.inventory_actions'::regclass,
                'public.business_users'::regclass, 'public.user_businesses'::regclass,
                'public.businesses'::regclass);

-- Effective privileges, including inheritance/PUBLIC (not merely visibility-
-- filtered information_schema.role_table_grants).
SELECT r.rolname, t.relation,
       has_table_privilege(r.oid, t.relation, 'SELECT') AS can_select,
       has_table_privilege(r.oid, t.relation, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, t.relation, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, t.relation, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, t.relation, 'TRIGGER') AS can_create_trigger
FROM pg_roles r
CROSS JOIN (VALUES ('public.products'), ('public.inventory_actions')) t(relation)
WHERE r.rolname IN ('anon', 'authenticated', 'service_role');

SELECT r.rolname, a.attname,
       has_column_privilege(r.oid, a.attrelid, a.attname, 'INSERT') AS can_insert,
       has_column_privilege(r.oid, a.attrelid, a.attname, 'UPDATE') AS can_update
FROM pg_roles r CROSS JOIN pg_attribute a
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND a.attrelid = 'public.products'::regclass AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY r.rolname, a.attnum;
-- Explicit direct ACL and inherited role inventory for proposed ACL narrowing.
SELECT CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
WHERE c.oid = 'public.products'::regclass;
SELECT r.rolname AS member_role, parent.rolname AS inherited_role,
       pg_has_role(r.oid, parent.oid, 'USAGE') AS currently_inherited
FROM pg_roles r CROSS JOIN pg_roles parent
WHERE r.rolname IN ('anon', 'authenticated') AND r.oid <> parent.oid
  AND pg_has_role(r.oid, parent.oid, 'MEMBER');

SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) AS definition,
       p.oid::regprocedure AS function_signature, p.prosecdef,
       pg_get_userbyid(p.proowner) AS function_owner, p.proconfig,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.products'::regclass AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('products', 'inventory_actions', 'business_users', 'user_businesses', 'businesses')
ORDER BY tablename, policyname;

SELECT p.oid::regprocedure AS signature, p.prosecdef, p.proconfig,
       pg_get_userbyid(p.proowner) AS owner, p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute,
       md5(pg_get_functiondef(p.oid)) AS definition_fingerprint,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('is_business_member', 'is_active_business_actor', 'can_manage_business_imports', 'can_business_write',
   'execute_inventory_transaction', 'reverse_inventory_action', 'reports_aggregate',
   'import_receipt_confirm', 'import_receipt_correct', 'import_order_close')
ORDER BY p.proname, p.oid;

-- Count-only diagnostics: no customer names, user emails, or credentials.
SELECT count(*) AS inventory_action_product_tenant_mismatches
FROM public.inventory_actions ia JOIN public.products p ON p.id = ia.product_id
WHERE ia.business_id IS DISTINCT FROM p.business_id;
SELECT count(*) AS approved_business_users_missing_user_businesses
FROM public.business_users bu
WHERE bu.status = 'approved' AND NOT EXISTS
  (SELECT 1 FROM public.user_businesses ub
   WHERE ub.business_id = bu.business_id AND ub.user_id = bu.user_id);
SELECT count(*) AS business_owners_missing_user_businesses
FROM public.businesses b WHERE NOT EXISTS
  (SELECT 1 FROM public.user_businesses ub
   WHERE ub.business_id = b.id AND ub.user_id = b.owner_id);

-- Confirm zero proposed objects before application. latest_receipt_id is
-- intentionally NOT proposed by Task 1A.
SELECT name, to_regclass(name) AS existing_relation
FROM (VALUES ('public.employees'), ('public.inventory_reservation_operations'),
             ('public.inventory_reservations')) t(name);
SELECT count(*) AS existing_reserved_columns FROM pg_attribute
WHERE attrelid = 'public.products'::regclass AND attname = 'reserved_quantity' AND NOT attisdropped;
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_registry;
-- If registry exists and inspection role has SELECT, separately inspect its
-- version/name rows after approval; do not assume local history = applied state.

-- Flag effective-role/security-definer writers for manual review; this is a
-- candidate inventory, NOT a proof of absence of dynamic SQL or nested writes.
SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner,
       p.proconfig, p.proacl, md5(pg_get_functiondef(p.oid)) AS definition_fingerprint
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  AND (p.prosrc ILIKE '%products%' OR p.prosrc ILIKE '%execute_inventory_transaction%')
ORDER BY p.oid::regprocedure::text;