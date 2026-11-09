-- TASK 1B: deterministic LOCAL SQL candidate; NOT APPLIED TO PRODUCTION.
-- Consolidated successor to docs/task-1b-security/01_security_hardening.proposed.sql.
-- This implements the bounded subset below, NOT complete authorization closure.
-- BLOCKED: canonical inventory body, onboarding, analytics/service-reader/frozen-context closure.
-- No SQL is executed by preparing this file. Separate execution approval required.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.user_businesses, public.business_users, public.categories IN ACCESS EXCLUSIVE MODE;

DO $membership_baseline$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.user_businesses'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.business_users'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.categories'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Required membership/category RLS baseline missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.business_users GROUP BY business_id,user_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Conflicting memberships require separate review; no data repair';
  END IF;
  IF EXISTS (SELECT 1 FROM public.business_users bu JOIN public.businesses b ON b.id=bu.business_id
    WHERE bu.role='OWNER' AND bu.user_id IS DISTINCT FROM b.owner_id) THEN
    RAISE EXCEPTION 'Nonowner OWNER membership requires authority review; no silent permission removal';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid IN
    ('public.user_businesses'::regclass,'public.business_users'::regclass) AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Unreviewed membership writer trigger';
  END IF;
END;
$membership_baseline$;

-- Actual ownership or one current approved membership. Anchors never authorize.
-- Keep the established signature/default/security/strictness of this helper.
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=_business_id AND b.owner_id=_user_id)
    OR (EXISTS (SELECT 1 FROM public.business_users bu
      WHERE bu.business_id=_business_id AND bu.user_id=_user_id AND bu.status='approved')
      AND NOT EXISTS (SELECT 1 FROM public.business_users bu
        WHERE bu.business_id=_business_id AND bu.user_id=_user_id AND bu.status IS DISTINCT FROM 'approved'));
$function$;
REVOKE ALL ON FUNCTION public.is_business_member(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.is_active_business_actor(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT _business_id IS NOT NULL AND _user_id IS NOT NULL AND (
    COALESCE(public.is_business_member(_business_id,_user_id),false)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user_id AND ur.role='admin'::public.user_role));
$function$;
REVOKE ALL ON FUNCTION public.is_active_business_actor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_active_business_actor(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.can_manage_business_imports(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT _business_id IS NOT NULL AND _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=_business_id AND b.owner_id=_user_id)
    OR (COALESCE(public.is_business_member(_business_id,_user_id),false)
      AND EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id=_business_id
        AND bu.user_id=_user_id AND bu.status='approved' AND bu.role='admin'))
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user_id AND ur.role='admin'::public.user_role));
$function$;
REVOKE ALL ON FUNCTION public.can_manage_business_imports(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business_imports(uuid,uuid) TO authenticated,service_role;

-- RESTRICTIVE policies AND all existing permissive policies: duplicate OR grants
-- cannot bypass these gates. Do not create a new approval/invitation endpoint.
CREATE POLICY t1b_anchor_insert_gate ON public.user_businesses AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=user_businesses.business_id AND b.owner_id=auth.uid()
    AND ((user_businesses.user_id=b.owner_id AND user_businesses.role='OWNER')
      OR (user_businesses.user_id<>b.owner_id AND user_businesses.role='EMPLOYEE'
        AND public.is_business_member(user_businesses.business_id,user_businesses.user_id)))));
CREATE POLICY t1b_anchor_update_gate ON public.user_businesses AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=user_businesses.business_id AND b.owner_id=auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=user_businesses.business_id AND b.owner_id=auth.uid()
    AND ((user_businesses.user_id=b.owner_id AND user_businesses.role='OWNER')
      OR (user_businesses.user_id<>b.owner_id AND user_businesses.role='EMPLOYEE'
        AND public.is_business_member(user_businesses.business_id,user_businesses.user_id)))));
CREATE POLICY t1b_member_insert_gate ON public.business_users AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND (
  (role='EMPLOYEE' AND status='pending') OR (role='OWNER' AND status='approved'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=business_users.business_id AND b.owner_id=auth.uid()))));
CREATE POLICY t1b_member_update_gate ON public.business_users AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=business_users.business_id AND b.owner_id=auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id=business_users.business_id AND b.owner_id=auth.uid()
  AND ((business_users.user_id=b.owner_id AND business_users.role='OWNER' AND business_users.status='approved')
    OR (business_users.user_id<>b.owner_id AND business_users.role='EMPLOYEE'
      AND business_users.status IN ('pending','approved','rejected')))));

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.user_businesses,public.business_users FROM PUBLIC,anon,authenticated;
DO $membership_columns$
DECLARE relation regclass; columns text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['public.user_businesses'::regclass,'public.business_users'::regclass] LOOP
    SELECT string_agg(format('%I',attname),', ' ORDER BY attnum) INTO columns
    FROM pg_attribute WHERE attrelid=relation AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON %s FROM PUBLIC,anon,authenticated',columns,columns,columns,relation);
  END LOOP;
END;
$membership_columns$;
GRANT INSERT(user_id,business_id,role), UPDATE(role) ON public.user_businesses TO authenticated;
GRANT INSERT(user_id,business_id,role,status), UPDATE(role,status) ON public.business_users TO authenticated;
-- Existing SELECT and service_role privileges intentionally unchanged.

-- Additional AND gate closes raw anchor category access without replacing
-- established global-category rules or touching can_business_write/billing.
CREATE POLICY t1b_category_membership_gate ON public.categories AS RESTRICTIVE
FOR ALL TO authenticated
USING (business_id IS NULL OR COALESCE(public.is_business_member(business_id,auth.uid()),false))
WITH CHECK (business_id IS NULL OR COALESCE(public.is_business_member(business_id,auth.uid()),false));

DO $effective_membership_acl$
DECLARE r text; relation regclass; cap text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH relation IN ARRAY ARRAY['public.user_businesses'::regclass,'public.business_users'::regclass] LOOP
      FOREACH cap IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r,relation,cap) THEN RAISE EXCEPTION 'Inherited membership table grant: %, %, %',r,relation,cap; END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=relation AND a.attnum>0 AND NOT a.attisdropped AND (
        has_column_privilege(r,relation,a.attname,'INSERT') IS DISTINCT FROM
          (r='authenticated' AND (a.attname IN ('user_id','business_id','role') OR (relation='public.business_users'::regclass AND a.attname='status')))
        OR has_column_privilege(r,relation,a.attname,'UPDATE') IS DISTINCT FROM
          (r='authenticated' AND (a.attname='role' OR (relation='public.business_users'::regclass AND a.attname='status')))
        OR has_column_privilege(r,relation,a.attname,'REFERENCES'))) THEN
        RAISE EXCEPTION 'Membership column capability differs from allowlist: %, %',r,relation;
      END IF;
    END LOOP;
  END LOOP;
END;
$effective_membership_acl$;

-- Independent ACL slice retained intact below (same transaction).
-- Stabilize the product relation during the approved maintenance transaction.
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;

DO $acl_hardening$
DECLARE
  v_product regclass := to_regclass('public.products');
  v_reverse regprocedure := to_regprocedure('public.reverse_inventory_action(uuid)');
  v_columns text;
  v_before jsonb;
  v_after jsonb;
  v_reverse_definition text;
  v_role text;
  v_cap text;
BEGIN
  IF v_product IS NULL OR v_reverse IS NULL THEN
    RAISE EXCEPTION 'Required product relation or exact reversal signature missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=v_product AND relkind='r' AND relrowsecurity) THEN
    RAISE EXCEPTION 'Product relation kind or RLS baseline changed';
  END IF;
  SELECT pg_get_functiondef(v_reverse) INTO v_reverse_definition;

  -- Preserve EFFECTIVE authenticated/service access, including PUBLIC/inheritance.
  -- If a PUBLIC revoke would remove legitimate access, abort rather than widen grants.
  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.role_name,s.object_name,s.capability)
  INTO v_before FROM (
    SELECT r.role_name,'products'::text AS object_name,c.capability,
      has_table_privilege(r.role_name,v_product,c.capability) AS allowed
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) c(capability)
    UNION ALL
    SELECT r.role_name,'products.'||a.attname,c.capability,
      has_column_privilege(r.role_name,v_product,a.attname,c.capability)
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) c(capability)
    CROSS JOIN pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT r.role_name,'reverse_inventory_action(uuid)','EXECUTE',
      has_function_privilege(r.role_name,v_reverse,'EXECUTE')
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
  ) s;

  REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.products FROM PUBLIC,anon;
  SELECT string_agg(format('%I',attname),', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute WHERE attrelid=v_product AND attnum>0 AND NOT attisdropped;
  IF v_columns IS NULL THEN RAISE EXCEPTION 'Product columns missing'; END IF;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.products FROM PUBLIC,anon',
    v_columns,v_columns,v_columns);
  REVOKE EXECUTE ON FUNCTION public.reverse_inventory_action(uuid) FROM PUBLIC,anon;

  FOREACH v_cap IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('anon',v_product,v_cap) THEN
      RAISE EXCEPTION 'Effective anonymous product capability remains: %',v_cap;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',v_product,a.attname,'INSERT')
        OR has_column_privilege('anon',v_product,a.attname,'UPDATE')
        OR has_column_privilege('anon',v_product,a.attname,'REFERENCES'))) THEN
    RAISE EXCEPTION 'Inherited anonymous column capabilities remain; review role graph';
  END IF;
  IF has_function_privilege('anon',v_reverse,'EXECUTE') THEN
    RAISE EXCEPTION 'Inherited anonymous reversal execution remains';
  END IF;

  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.role_name,s.object_name,s.capability)
  INTO v_after FROM (
    SELECT r.role_name,'products'::text AS object_name,c.capability,
      has_table_privilege(r.role_name,v_product,c.capability) AS allowed
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) c(capability)
    UNION ALL
    SELECT r.role_name,'products.'||a.attname,c.capability,
      has_column_privilege(r.role_name,v_product,a.attname,c.capability)
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) c(capability)
    CROSS JOIN pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT r.role_name,'reverse_inventory_action(uuid)','EXECUTE',
      has_function_privilege(r.role_name,v_reverse,'EXECUTE')
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
  ) s;
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Authenticated/service effective privileges changed; transaction must abort';
  END IF;
  IF pg_get_functiondef(v_reverse) IS DISTINCT FROM v_reverse_definition THEN
    RAISE EXCEPTION 'Reversal definition changed during ACL preparation';
  END IF;
  -- No DML, policy/function replacement, default ACL edits or new grants.
END;
$acl_hardening$;
COMMIT;