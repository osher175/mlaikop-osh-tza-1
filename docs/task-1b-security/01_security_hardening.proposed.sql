-- PREPARATION ONLY. DO NOT EXECUTE WITHOUT SEPARATE APPROVAL.
-- Based on Task 1B production catalog evidence captured 2026-11-09.
-- Never copy into supabase/migrations: the migration tool owns that history.
-- No data repair, backfill, reservation activation, billing or import rewrite.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $baseline$
DECLARE
  v_inventory regprocedure := to_regprocedure('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)');
BEGIN
  IF to_regclass('public.user_businesses') IS NULL
     OR to_regclass('public.business_users') IS NULL THEN
    RAISE EXCEPTION 'Required membership tables missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.user_businesses'::regclass AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (user_id)') THEN
    RAISE EXCEPTION 'Production user_businesses primary key drift';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid IN ('public.user_businesses'::regclass, 'public.business_users'::regclass)
      AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Membership triggers appeared: review provisioning first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy p
    WHERE p.polrelid IN ('public.user_businesses'::regclass, 'public.business_users'::regclass)
      AND p.polcmd IN ('a','w','d','*') AND p.polname NOT IN (
        'Users can create their own business relationships',
        'Business owners can update member roles',
        'Business owners can update member status',
        'business_users_insert_policy', 'business_users_update_policy')) THEN
    RAISE EXCEPTION 'Unexpected membership write policy: reconcile all OR paths';
  END IF;
  IF v_inventory IS NULL OR md5(pg_get_functiondef(v_inventory))
       <> 'cab73c49bb419f7e3dd5dab14f144e4b' THEN
    RAISE EXCEPTION 'Canonical inventory function changed: review exact live body';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_businesses ub
    JOIN public.businesses b ON b.id = ub.business_id
    WHERE ub.user_id IS DISTINCT FROM b.owner_id AND NOT EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.business_id = ub.business_id AND bu.user_id = ub.user_id
        AND bu.status = 'approved')) THEN
    RAISE EXCEPTION 'Unapproved legacy membership: investigate; no automatic data repair';
  END IF;
END;
$baseline$;

-- Replace every observed permissive INSERT/UPDATE path, not just one duplicate.
DROP POLICY "Users can create their own business relationships" ON public.user_businesses;
DROP POLICY "Business owners can update member roles" ON public.user_businesses;
DROP POLICY "Users can create their own business relationships" ON public.business_users;
DROP POLICY "Business owners can update member status" ON public.business_users;
DROP POLICY business_users_insert_policy ON public.business_users;
DROP POLICY business_users_update_policy ON public.business_users;

-- user_businesses is a trusted membership anchor, not a join-request table.
-- Owners may provision themselves, or another user already approved in THEIR
-- business, with the exact approved role. No self-selected arbitrary tenant.
CREATE POLICY t1bs_user_businesses_owner_insert ON public.user_businesses
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.businesses b
    WHERE b.id = user_businesses.business_id AND b.owner_id = auth.uid()
      AND ((user_businesses.user_id = b.owner_id AND user_businesses.role = 'OWNER')
        OR EXISTS (SELECT 1 FROM public.business_users bu
          WHERE bu.business_id = user_businesses.business_id
            AND bu.user_id = user_businesses.user_id AND bu.status = 'approved'
            AND bu.role = user_businesses.role)))
);
CREATE POLICY t1bs_user_businesses_owner_update ON public.user_businesses
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b
  WHERE b.id = user_businesses.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b
  WHERE b.id = user_businesses.business_id AND b.owner_id = auth.uid()
    AND ((user_businesses.user_id = b.owner_id AND user_businesses.role = 'OWNER')
      OR EXISTS (SELECT 1 FROM public.business_users bu
        WHERE bu.business_id = user_businesses.business_id
          AND bu.user_id = user_businesses.user_id AND bu.status = 'approved'
          AND bu.role = user_businesses.role))));

-- A nonowner may request access, never self-approve or select a manager role.
-- Preserve the legacy actual-owner creation payload (OWNER, approved).
CREATE POLICY t1bs_business_users_request_or_owner_insert ON public.business_users
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (
    (role = 'EMPLOYEE' AND status = 'pending')
    OR (role = 'OWNER' AND status = 'approved' AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_users.business_id AND b.owner_id = auth.uid()))
  )
);
CREATE POLICY t1bs_business_users_owner_update ON public.business_users
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b
  WHERE b.id = business_users.business_id AND b.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b
  WHERE b.id = business_users.business_id AND b.owner_id = auth.uid()));

-- Prevent identity/tenant moves, direct deletes, and privileged maintenance
-- operations by API callers. Existing SECURITY DEFINER owner provisioning
-- remains effective; service_role retains its existing trusted grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.user_businesses, public.business_users FROM PUBLIC, anon, authenticated;
DO $membership_columns$
DECLARE v_table text; v_columns text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['user_businesses','business_users'] LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_columns FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.' || v_table)
      AND a.attnum > 0 AND NOT a.attisdropped;
    EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON public.%I FROM PUBLIC, anon, authenticated',
      v_columns, v_columns, v_table);
  END LOOP;
END;
$membership_columns$;
GRANT INSERT (user_id, business_id, role), UPDATE (role)
  ON public.user_businesses TO authenticated;
GRANT INSERT (user_id, business_id, role, status), UPDATE (role, status)
  ON public.business_users TO authenticated;

-- Source of anon product writes: postgres default table ACL + explicit table
-- ACL. Do not change global defaults or authenticated product permissions.
REVOKE INSERT, UPDATE ON public.products FROM PUBLIC, anon;
DO $product_columns$
DECLARE v_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
  INTO v_columns FROM pg_attribute a
  WHERE a.attrelid = 'public.products'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s) ON public.products FROM PUBLIC, anon',
    v_columns, v_columns);
  IF EXISTS (SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.products'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',a.attrelid,a.attname,'INSERT')
        OR has_column_privilege('anon',a.attrelid,a.attname,'UPDATE'))) THEN
    RAISE EXCEPTION 'Inherited anon product writes remain';
  END IF;
END;
$product_columns$;

-- Exact minimal textual changes to the fingerprint-checked live canonical
-- body. No rolling cost, stock lock, financial, import or ledger logic rewrite.
-- current_setting('role') identifies the PostgREST caller role; current_user
-- identifies the DEFINER owner and must NEVER authorize the caller here.
DO $inventory_auth$
DECLARE
  v_oid regprocedure := to_regprocedure('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)');
  v_body text;
  v_old_role text := E'IF current_setting(''role'', true) = ''service_role''\n       OR current_user IN (''service_role'', ''postgres'', ''supabase_admin'') THEN';
  v_old_actor text := E'IF v_caller IS NOT NULL\n     AND NOT public.is_active_business_actor(p_business_id, v_caller) THEN';
BEGIN
  v_body := pg_get_functiondef(v_oid);
  IF strpos(v_body,v_old_role)=0 OR strpos(v_body,v_old_actor)=0 THEN
    RAISE EXCEPTION 'Inventory authorization block drift';
  END IF;
  v_body := replace(v_body,v_old_role,
    'IF current_setting(''role'', true) = ''service_role'' THEN');
  v_body := replace(v_body,v_old_actor,
    'IF public.is_active_business_actor(p_business_id, v_actor) IS DISTINCT FROM true THEN');
  EXECUTE v_body;
END;
$inventory_auth$;
REVOKE EXECUTE ON FUNCTION public.reverse_inventory_action(uuid) FROM PUBLIC, anon;
-- Other reviewed inventory/import RPCs already deny anon/PUBLIC; preserve
-- existing authenticated/service EXECUTE. Do not add billing gates here.

-- Fail closed if inherited or future-column membership writes defeat grants.
DO $effective_acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute a
    WHERE a.attrelid IN ('public.user_businesses'::regclass,'public.business_users'::regclass)
      AND a.attnum > 0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',a.attrelid,a.attname,'INSERT')
        OR has_column_privilege('anon',a.attrelid,a.attname,'UPDATE')
        OR (a.attname NOT IN ('role','status') AND
          has_column_privilege('authenticated',a.attrelid,a.attname,'UPDATE')))) THEN
    RAISE EXCEPTION 'Unexpected effective membership write capability remains';
  END IF;
END;
$effective_acl$;
COMMIT;