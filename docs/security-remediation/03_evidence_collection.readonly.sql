-- TASK 1B PREPARED PREFLIGHT + VERIFICATION; no queries executed.
-- Sections 1-2 below are the preflight; section 3 is post-candidate verification.
-- Separate SELECT-only approval required. No mutation RPC calls, SET ROLE or spoofed claims.
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

-- SECTION 2: effective membership privileges and combined policy behavior.
-- Preflight expected: known broad writes. After candidate: table writes FALSE,
-- INSERT column allowlist user_id/business_id/role (+ status for business_users),
-- UPDATE role (+ status for business_users); anon all writes FALSE.
SELECT r.role_name,c.oid::regclass AS relation,cap.capability,
  has_table_privilege(r.role_name,c.oid,cap.capability) AS allowed
FROM pg_class c CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) cap(capability)
WHERE c.oid IN ('public.user_businesses'::regclass,'public.business_users'::regclass);
SELECT r.role_name,a.attrelid::regclass AS relation,a.attname,cap.capability,
  has_column_privilege(r.role_name,a.attrelid,a.attname,cap.capability) AS allowed
FROM pg_attribute a CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role_name)
CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('REFERENCES')) cap(capability)
WHERE a.attrelid IN ('public.user_businesses'::regclass,'public.business_users'::regclass)
  AND a.attnum>0 AND NOT a.attisdropped;
-- Evaluate (OR permissive applicable policies) AND (AND restrictive applicable policies).
-- Do not mistake merely counting policies for testing RLS.
SELECT schemaname,tablename,cmd,permissive,policyname,roles,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('user_businesses','business_users','categories','products','inventory_actions','import_orders','import_receipts')
ORDER BY tablename,cmd,permissive,policyname;

-- SECTION 3: unexecuted post-candidate verification. Read-only helper checks;
-- privileged catalog readers do NOT prove JWT authentication or real RLS access.
-- Aggregate only; no user IDs or personal information returned.
-- Actual owner membership and imports: expected zero denied owners.
SELECT count(*) FILTER (WHERE public.is_business_member(id,owner_id) IS NOT TRUE) AS denied_owners,
 count(*) FILTER (WHERE public.can_manage_business_imports(id,owner_id) IS NOT TRUE) AS denied_import_owners
FROM public.businesses;
-- Approved users: expected zero denied current approved pairs.
SELECT count(*) FILTER (WHERE public.is_business_member(bu.business_id,bu.user_id) IS NOT TRUE) AS denied_approved
FROM public.business_users bu WHERE bu.status='approved' AND NOT EXISTS (
 SELECT 1 FROM public.business_users other WHERE other.business_id=bu.business_id AND other.user_id=bu.user_id
 AND other.status IS DISTINCT FROM 'approved');
-- Pending/rejected/revoked/nonapproved nonowners: expected zero allowed.
-- Production CHECK may not support literal 'revoked'; all nonapproved states deny.
SELECT bu.status,count(*) FILTER (WHERE public.is_business_member(bu.business_id,bu.user_id) IS TRUE) AS wrongly_allowed
FROM public.business_users bu JOIN public.businesses b ON b.id=bu.business_id
WHERE bu.user_id IS DISTINCT FROM b.owner_id AND bu.status IS DISTINCT FROM 'approved' GROUP BY bu.status;
-- Retained stale anchors: expected zero membership/import allowances.
SELECT count(*) FILTER (WHERE public.is_business_member(ub.business_id,ub.user_id) IS TRUE) AS stale_member_allowed,
 count(*) FILTER (WHERE public.can_manage_business_imports(ub.business_id,ub.user_id) IS TRUE
 AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=ub.user_id AND ur.role='admin'::public.user_role)) AS stale_import_allowed
FROM public.user_businesses ub JOIN public.businesses b ON b.id=ub.business_id
WHERE ub.user_id IS DISTINCT FROM b.owner_id AND NOT EXISTS (
 SELECT 1 FROM public.business_users bu WHERE bu.business_id=ub.business_id AND bu.user_id=ub.user_id AND bu.status='approved');
-- Cross-business helper isolation: only nonowner/nonapproved pairs; expected zero allowed.
SELECT count(*) FILTER (WHERE public.is_business_member(b.id,u.user_id) IS TRUE) AS cross_business_allowed
FROM public.businesses b CROSS JOIN (SELECT DISTINCT user_id FROM public.business_users) u
WHERE u.user_id IS DISTINCT FROM b.owner_id AND NOT EXISTS (
 SELECT 1 FROM public.business_users bu WHERE bu.business_id=b.id AND bu.user_id=u.user_id AND bu.status='approved');
-- Anonymous reversal expected false; authenticated/service must match captured preflight.
SELECT r.role_name,has_function_privilege(r.role_name,'public.reverse_inventory_action(uuid)','EXECUTE') AS allowed
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role_name);
-- Gate inventory expected five rows, permissive=false, correct command/roles/expressions.
SELECT tablename,policyname,permissive,cmd,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND policyname IN ('t1b_anchor_insert_gate','t1b_anchor_update_gate',
 't1b_member_insert_gate','t1b_member_update_gate','t1b_category_membership_gate');
-- No replaced helper may contain a raw anchor reference. Expected zero rows.
SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('is_business_member','is_active_business_actor','can_manage_business_imports')
AND p.prosrc ILIKE '%user_businesses%';
-- Remaining consumers are blockers, NOT expected to disappear from this partial candidate.
SELECT p.oid::regprocedure AS unresolved_consumer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc ILIKE '%user_businesses%';

-- MANUAL ISOLATED ACCEPTANCE MATRIX (prepared expectations, NOT SQL execution):
-- owner/current approved: inventory and permitted categories read/write succeed;
-- pending/rejected/revoked + retained anchor: tenant rows inaccessible;
-- self approved/OWNER INSERT or employee OWNER UPDATE: denied;
-- membership user_id/business_id UPDATE: denied by effective column ACL;
-- other-business rows: denied; analytics may still be BLOCKED by unchanged helpers;
-- genuine signed-in receipt confirm/correct: nested canonical actor equals auth.uid,
-- exact financial/quantity/provenance results retained; currently BLOCKED/unexecuted;
-- forged p_user_id/missing verified identity: expected deny after future inventory fix;
-- current candidate does NOT satisfy that expectation, mark BLOCKED;
-- reversal anon EXECUTE: denied; reversal stale-original-actor: BLOCKED;
-- protected platform admin exceptions: identical to baseline on replaced helpers.
-- Do not invoke mutating inventory/import/onboarding/reversal RPCs in this file.
