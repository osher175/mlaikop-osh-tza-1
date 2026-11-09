-- PREPARED ONLY; no queries executed. Separate SELECT-only approval required.
-- Catalog/source outputs require restricted handling; do not publish raw bodies
-- if legacy definitions contain credentials. No auth.users data or tokens read.
SELECT current_database(),current_user,session_user,version();

-- Role boundary and inherited capability graph (no credentials).
SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcanlogin,rolbypassrls
FROM pg_roles ORDER BY rolname;
SELECT parent.rolname AS granted_role,member.rolname AS member_role,m.admin_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member ORDER BY 1,2;

SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) AS owner,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
  ('products','inventory_actions','user_businesses','business_users','businesses','user_roles','profiles');
SELECT a.attrelid::regclass AS relation,a.attname,format_type(a.atttypid,a.atttypmod),
  a.attnotnull,a.attacl,pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid IN (to_regclass('public.user_businesses'),to_regclass('public.business_users'),
  to_regclass('public.businesses'),to_regclass('public.user_roles'),to_regclass('public.products'))
  AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1, a.attnum;
SELECT conrelid::regclass AS relation,conname,pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid IN (to_regclass('public.user_businesses'),
  to_regclass('public.business_users'),to_regclass('public.businesses'),to_regclass('public.user_roles'));

-- Full policy inventory includes direct anchors, wrapper callers and storage.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies ORDER BY schemaname,tablename,policyname;

-- ALL public routines: inspect recursively; filtering only known symbols misses wrappers.
SELECT p.oid::regprocedure AS signature,pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef,p.provolatile,p.proconfig,p.proacl,
  pg_get_function_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
  md5(pg_get_functiondef(p.oid)) AS drift_fingerprint,pg_get_functiondef(p.oid) AS exact_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY signature::text;

SELECT t.tgrelid::regclass AS relation,t.tgname,t.tgfoid::regprocedure AS function,
  pg_get_triggerdef(t.oid),t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1,2;
SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname='public';
SELECT schemaname,matviewname,definition FROM pg_matviews WHERE schemaname='public';
SELECT schemaname,tablename,rulename,definition FROM pg_rules WHERE schemaname='public';
SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent,
  pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS referenced,d.deptype
FROM pg_depend d WHERE d.refobjid IN (
  to_regclass('public.user_businesses'),to_regclass('public.business_users'),
  to_regclass('public.businesses'),to_regclass('public.user_roles'))
  OR (d.refclassid='pg_proc'::regclass AND d.refobjid IN (
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('is_business_member','is_active_business_actor','can_manage_business_imports','execute_inventory_transaction')));
-- pg_depend does not capture every PL/pgSQL/dynamic/external dependency.

-- Independent ACL preflight AND post-migration evidence. Expected anon writes false after.
SELECT r.role_name,c.capability,has_table_privilege(r.role_name,'public.products',c.capability) AS allowed
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) c(capability);
SELECT r.role_name,a.attname,c.capability,
  has_column_privilege(r.role_name,a.attrelid,a.attname,c.capability) AS allowed
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) c(capability)
CROSS JOIN pg_attribute a WHERE a.attrelid='public.products'::regclass AND a.attnum>0 AND NOT a.attisdropped;
SELECT p.oid::regprocedure AS signature,r.role_name,
  has_function_privilege(r.role_name,p.oid,'EXECUTE') AS executable,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
WHERE n.nspname='public' AND p.proname IN ('reverse_inventory_action','execute_inventory_transaction',
  'import_receipt_confirm','import_receipt_correct','import_order_close');
SELECT pg_get_userbyid(defaclrole) AS owner,defaclnamespace::regnamespace,defaclobjtype,defaclacl
FROM pg_default_acl;

-- Aggregate membership diagnostics only; no IDs/emails or data repair.
SELECT status,role,count(*) FROM public.business_users GROUP BY status,role ORDER BY status,role;
SELECT count(*) AS duplicate_membership_pairs FROM (
  SELECT business_id,user_id FROM public.business_users GROUP BY business_id,user_id HAVING count(*)>1
) duplicates;
SELECT count(*) AS stale_nonowner_anchors FROM public.user_businesses ub
JOIN public.businesses b ON b.id=ub.business_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id AND NOT EXISTS (
  SELECT 1 FROM public.business_users bu WHERE bu.business_id=ub.business_id
    AND bu.user_id=ub.user_id AND bu.status='approved');
SELECT count(*) AS approved_users_without_anchors FROM public.business_users bu
WHERE bu.status='approved' AND NOT EXISTS (
  SELECT 1 FROM public.user_businesses ub WHERE ub.business_id=bu.business_id AND ub.user_id=bu.user_id);
SELECT count(*) AS owners_without_anchors FROM public.businesses b WHERE NOT EXISTS (
  SELECT 1 FROM public.user_businesses ub WHERE ub.business_id=b.id AND ub.user_id=b.owner_id);

-- Catalog counts are NOT approval provenance, JWT verification, runtime RLS
-- tests or external-consumer evidence. Hosted ingress/config, cron callers,
-- membership authority and frozen context dependencies still need review.