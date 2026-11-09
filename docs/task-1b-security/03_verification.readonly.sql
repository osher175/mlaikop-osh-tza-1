-- PREPARATION ONLY. Run ONLY after separately approved application.
-- SELECT-only: this is not a substitute for approved isolated runtime tests.
SELECT current_user,now() AS captured_at;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('user_businesses','business_users','products')
ORDER BY tablename,policyname;
-- Exactly four new membership write policies; no old permissive write path.
SELECT count(*) AS new_write_policies FROM pg_policies
WHERE schemaname='public' AND policyname IN ('t1bs_user_businesses_owner_insert',
  't1bs_user_businesses_owner_update','t1bs_business_users_request_or_owner_insert',
  't1bs_business_users_owner_update');
SELECT r.rolname,a.attrelid::regclass AS relation,a.attname,
  has_column_privilege(r.oid,a.attrelid,a.attname,'INSERT') AS can_insert,
  has_column_privilege(r.oid,a.attrelid,a.attname,'UPDATE') AS can_update
FROM pg_roles r CROSS JOIN pg_attribute a
WHERE r.rolname IN ('anon','authenticated','service_role') AND a.attnum>0 AND NOT a.attisdropped
  AND a.attrelid IN ('public.products'::regclass,'public.user_businesses'::regclass,
    'public.business_users'::regclass) ORDER BY a.attrelid,r.rolname,a.attnum;
-- anon product and membership INSERT/UPDATE all false. authenticated product
-- privileges match baseline; membership UPDATE limited to role / role,status.
SELECT r.rolname,c.oid::regclass AS relation,
  has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
  has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
  has_table_privilege(r.oid,c.oid,'TRIGGER') AS can_trigger
FROM pg_roles r CROSS JOIN pg_class c
WHERE r.rolname IN ('anon','authenticated','service_role') AND c.oid IN
  ('public.user_businesses'::regclass,'public.business_users'::regclass);
SELECT p.oid::regprocedure AS signature,p.prosecdef,p.proconfig,
  pg_get_userbyid(p.proowner) AS owner,p.proacl,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
  md5(pg_get_functiondef(p.oid)) AS fingerprint,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('execute_inventory_transaction',
  'reverse_inventory_action','import_receipt_confirm','import_receipt_correct','import_order_close',
  'is_business_member','is_active_business_actor','can_manage_business_imports',
  'create_business_for_new_user','complete_business_onboarding','get_user_business_context')
ORDER BY p.proname,p.oid;
-- Five inventory/import RPCs: anon false; authenticated/service unchanged.
-- Only canonical inventory auth body changes; reversal body and import bodies
-- MUST retain baseline fingerprints. Membership helper/admin bypass unchanged.
SELECT 'user_businesses' AS dataset,count(*) AS rows,
  md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.user_id),'')) AS fingerprint
FROM public.user_businesses t;
SELECT 'business_users' AS dataset,count(*) AS rows,
  md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) AS fingerprint
FROM public.business_users t;
-- Compare only at an approved quiescent point; concurrent activity invalidates
-- fingerprint equality. No membership rows should be changed by migration.
SELECT t.tgrelid::regclass AS relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)
FROM pg_trigger t WHERE t.tgrelid IN ('public.products'::regclass,
  'public.user_businesses'::regclass,'public.business_users'::regclass) AND NOT t.tgisinternal;
-- Existing product triggers unchanged; no new membership sync trigger.
SELECT name,to_regclass(name) AS existing FROM (VALUES ('public.employees'),
  ('public.inventory_reservations'),('public.inventory_reservation_operations')) t(name);
-- Task 1A is separate: these should remain absent if not separately applied.