-- PREPARATION ONLY. NOT EXECUTED IN TASK 1B-SECURITY.
-- SELECT-only; obtain separate approval to run against production.
-- Catalog visibility and BYPASSRLS/complete aggregate visibility required.
-- Save securely: definitions can contain historical literals; never publish
-- customer records, credentials, migration statement payloads or auth data.
-- Production execution is NOT authorized by this review. Dependency inventory
-- first: stop before dependent SELECTs if any relation/column is missing.
SELECT relation,column_name,to_regclass(relation) AS relation_oid,
  EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass(relation)
    AND a.attname=column_name AND a.attnum>0 AND NOT a.attisdropped) AS present
FROM (VALUES ('public.user_businesses','user_id'),('public.user_businesses','business_id'),
  ('public.user_businesses','role'),('public.business_users','id'),
  ('public.business_users','user_id'),('public.business_users','business_id'),
  ('public.business_users','role'),('public.business_users','status'),
  ('public.businesses','owner_id'),('public.businesses','id')) d(relation,column_name);
SELECT current_user, now() AS captured_at, version();
SELECT c.oid::regclass AS relation, c.relrowsecurity, c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c WHERE c.oid IN (to_regclass('public.products'),
  to_regclass('public.user_businesses'),to_regclass('public.business_users'));
SELECT a.attrelid::regclass AS relation,a.attname,
  format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,
  pg_get_expr(d.adbin,d.adrelid) AS column_default,a.attacl
FROM pg_attribute a LEFT JOIN pg_attrdef d
  ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid IN (to_regclass('public.user_businesses'),to_regclass('public.business_users'),
  to_regclass('public.products')) AND a.attnum>0 AND NOT a.attisdropped;
SELECT c.conrelid::regclass AS relation,c.conname,pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c WHERE c.conrelid IN
  (to_regclass('public.user_businesses'),to_regclass('public.business_users'));
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('user_businesses','business_users','products')
ORDER BY tablename,policyname;
SELECT t.tgrelid::regclass AS relation,t.tgname,t.tgenabled,
  pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)
FROM pg_trigger t WHERE t.tgrelid IN (to_regclass('public.user_businesses'),
  to_regclass('public.business_users'),to_regclass('public.products')) AND NOT t.tgisinternal;
SELECT r.rolname,a.attrelid::regclass AS relation,a.attname,
  has_column_privilege(r.oid,a.attrelid,a.attname,'INSERT') AS can_insert,
  has_column_privilege(r.oid,a.attrelid,a.attname,'UPDATE') AS can_update
FROM pg_roles r CROSS JOIN pg_attribute a
WHERE r.rolname IN ('anon','authenticated','service_role') AND a.attnum>0 AND NOT a.attisdropped
  AND a.attrelid IN (to_regclass('public.products'),to_regclass('public.user_businesses'),
    to_regclass('public.business_users')) ORDER BY a.attrelid,r.rolname,a.attnum;
SELECT r.rolname,c.oid::regclass AS relation,
  has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
  has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
  has_table_privilege(r.oid,c.oid,'TRIGGER') AS can_trigger
FROM pg_roles r CROSS JOIN pg_class c
WHERE r.rolname IN ('anon','authenticated','service_role') AND c.oid IN
  (to_regclass('public.user_businesses'),to_regclass('public.business_users'));
SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl
FROM pg_default_acl WHERE defaclnamespace=to_regnamespace('public');
SELECT r.rolname,parent.rolname AS parent,
  pg_has_role(r.oid,parent.oid,'USAGE') AS inherited
FROM pg_roles r CROSS JOIN pg_roles parent
WHERE r.rolname IN ('anon','authenticated') AND r.oid<>parent.oid
  AND pg_has_role(r.oid,parent.oid,'MEMBER');
SELECT p.oid::regprocedure AS signature,p.prosecdef,p.proconfig,
  pg_get_userbyid(p.proowner) AS owner,p.proacl,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
  md5(pg_get_functiondef(p.oid)) AS fingerprint,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND
  (p.proname IN ('is_business_member','is_active_business_actor','can_manage_business_imports',
    'create_business_for_new_user','complete_business_onboarding','get_user_business_context',
    'execute_inventory_transaction','reverse_inventory_action','import_receipt_confirm',
    'import_receipt_correct','import_order_close')
   OR p.prosrc ILIKE '%user_businesses%' OR p.prosrc ILIKE '%business_users%')
ORDER BY p.proname,p.oid;
-- Run following only after verifying all required tables/columns above.
SELECT count(*) AS unapproved_nonowner_links FROM public.user_businesses ub
JOIN public.businesses b ON b.id=ub.business_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id AND NOT EXISTS (
  SELECT 1 FROM public.business_users bu WHERE bu.business_id=ub.business_id
    AND bu.user_id=ub.user_id AND bu.status='approved');
SELECT count(*) AS approved_members_missing_anchor FROM public.business_users bu
WHERE bu.status='approved' AND NOT EXISTS (SELECT 1 FROM public.user_businesses ub
  WHERE ub.business_id=bu.business_id AND ub.user_id=bu.user_id);
SELECT count(*) AS nonowner_role_mismatches FROM public.user_businesses ub
JOIN public.businesses b ON b.id=ub.business_id
JOIN public.business_users bu ON bu.business_id=ub.business_id AND bu.user_id=ub.user_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id AND bu.status='approved'
  AND ub.role IS DISTINCT FROM bu.role;
SELECT 'user_businesses' AS dataset,count(*) AS rows,
  md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.user_id),'')) AS fingerprint
FROM public.user_businesses t;
SELECT 'business_users' AS dataset,count(*) AS rows,
  md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) AS fingerprint
FROM public.business_users t;
SELECT to_regclass('supabase_migrations.schema_migrations') AS registry;
-- After registry visibility confirmed, SELECT version,name only. Do not
-- infer exact live function bodies from local or production version labels.
-- COMPLETE PUBLIC DIRECT LINK CONSUMER INVENTORY, not a claim of transitive
-- completeness. Inspect every definition and its called functions recursively.
-- Include views/rules; searching only helpers misses raw-link RLS and APIs.
SELECT p.oid::regprocedure AS signature,p.prosecdef,p.proconfig,p.proacl,
  pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS exact_source
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
  AND (p.prosrc ILIKE '%user_businesses%' OR p.prosrc ILIKE '%business_users%'
    OR p.prosrc ILIKE '%is_business_member%' OR p.prosrc ILIKE '%is_active_business_actor%'
    OR p.prosrc ILIKE '%can_manage_business_imports%');
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND
  (COALESCE(qual,'') || ' ' || COALESCE(with_check,'')) ~*
  '(user_businesses|business_users|is_business_member|is_active_business_actor|can_manage_business_imports)';
SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname='public'
  AND definition ~* '(user_businesses|business_users|is_business_member|is_active_business_actor|can_manage_business_imports)';
SELECT schemaname,matviewname,definition FROM pg_matviews WHERE schemaname='public'
  AND definition ~* '(user_businesses|business_users|is_business_member|is_active_business_actor|can_manage_business_imports)';
SELECT schemaname,tablename,rulename,definition FROM pg_rules WHERE schemaname='public'
  AND definition ~* '(user_businesses|business_users|is_business_member|is_active_business_actor|can_manage_business_imports)';
-- Catalog dependency edges supplement text searches; dynamic SQL and external
-- services still need source/caller review. pg_depend is not full call tracing.
SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent,
  pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS referenced,d.deptype
FROM pg_depend d WHERE d.refclassid='pg_class'::regclass AND d.refobjid IN
  (to_regclass('public.user_businesses'),to_regclass('public.business_users'));
-- Pending/rejected/missing approval stale anchors; count only, no customer IDs.
SELECT COALESCE(bu.status,'missing') AS approval_status,count(*) AS nonowner_links
FROM public.user_businesses ub JOIN public.businesses b ON b.id=ub.business_id
LEFT JOIN public.business_users bu ON bu.business_id=ub.business_id AND bu.user_id=ub.user_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id GROUP BY COALESCE(bu.status,'missing');
-- Capture entire pg_proc identity/contract/ACL for all reviewed RPCs.
SELECT p.oid,p.oid::regprocedure AS signature,p.proowner,p.proacl,p.prosecdef,
  p.proconfig,p.proargtypes,p.proallargtypes,p.proargmodes,p.proargnames,
  p.prorettype,p.pronargdefaults,pg_get_expr(p.proargdefaults,0) AS defaults,
  pg_get_functiondef(p.oid) AS exact_source
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('execute_inventory_transaction',
  'reverse_inventory_action','import_receipt_confirm','import_receipt_correct','import_order_close');
-- Catalog alone cannot verify JWT validation, direct SQL GUC-setting capability,
-- deployed Edge callers, employee approval UI, external provisioning or active
-- session revocation. Those are explicit separate evidence/approval gates.
