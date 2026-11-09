-- PREPARATION ONLY. Run ONLY after separately approved application.
-- SELECT-only: this is not a substitute for approved isolated runtime tests.
SELECT current_user,now() AS captured_at;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('user_businesses','business_users','products')
ORDER BY tablename,policyname;
-- This draft is intentionally gated and cannot be applied. For a separately
-- approved successor, verify full definitions/roles/permissiveness, not names.
-- Four candidate membership write policies alone do NOT solve stale reads.
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
-- Inventory replacement has been WITHDRAWN from the gated draft; every
-- existing RPC body remains unchanged. Any successor must compare exact source
-- and all pg_proc contract/owner/ACL fields, not MD5 alone. Stale-link helper or
-- policy remediation remains BLOCKED and requires its own approved manifest.
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
-- No unexpected alternative write policy, including ALL policies.
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('user_businesses','business_users') AND cmd IN ('INSERT','UPDATE','DELETE','ALL');
SELECT p.oid,p.oid::regprocedure AS signature,p.proowner,p.proacl,p.prosecdef,
  p.proconfig,p.proargtypes,p.proallargtypes,p.proargmodes,p.proargnames,
  p.prorettype,p.pronargdefaults,pg_get_expr(p.proargdefaults,0) AS defaults,
  pg_get_functiondef(p.oid) AS exact_source
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('execute_inventory_transaction',
  'reverse_inventory_action','import_receipt_confirm','import_receipt_correct','import_order_close');
-- Enumerate ALL remaining raw-link / helper RLS consumers; manually compare
-- them with the approved successor manifest. Rows here are not automatically
-- defects, but every pending/revoked raw-link bypass must be resolved.
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND
  (COALESCE(qual,'') || ' ' || COALESCE(with_check,'')) ~*
  '(user_businesses|business_users|is_business_member|is_active_business_actor|can_manage_business_imports)';
SELECT COALESCE(bu.status,'missing') AS approval_status,count(*) AS nonowner_links
FROM public.user_businesses ub JOIN public.businesses b ON b.id=ub.business_id
LEFT JOIN public.business_users bu ON bu.business_id=ub.business_id AND bu.user_id=ub.user_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id GROUP BY COALESCE(bu.status,'missing');
-- Zero stale anchors at one instant does not prove future revocation works.
-- Separately approved isolated checks must cover pending, approved, revoked,
-- retained-anchor and role-change states across every access path, plus real
-- owner onboarding and import confirmation/correction/closure. Do not run
-- those mutations or JWT/SQL write probes as part of these SELECTs.
