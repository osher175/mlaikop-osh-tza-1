-- PREPARATION ONLY. DO NOT EXECUTE WITHOUT SEPARATE APPROVAL.
-- Based on Task 1B production catalog evidence captured 2026-11-09.
-- Never copy into supabase/migrations: the migration tool owns that history.
-- No data repair, backfill, reservation activation, billing or import rewrite.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- NON-EXECUTABLE REVIEW DRAFT: this unconditional gate precedes all DDL.
-- It is not a session setting, caller claim or permission bypass. Do not
-- delete it merely to apply the partial ACL/policy candidate below.
-- A separately reviewed successor must include the full approved membership
-- lifecycle, stale-link enforcement and a verified inventory caller boundary.
DO $readiness_gate$
BEGIN
  RAISE EXCEPTION 'BLOCKED: approval/revocation lifecycle, all stale-link consumers and inventory caller authentication unresolved';
END;
$readiness_gate$;

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
-- CONDITIONAL POLICY CANDIDATE ONLY, NOT an approved provisioning model.
-- Owner self-provisioning and prior approved employee linkage need confirmation
-- against exact live provisioning RPCs and external owner-approval callers.
-- These write predicates do NOT revoke access through an existing stale link.
-- Do not apply until every direct/helper stale-link read path is addressed.
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

-- INVENTORY AUTHORIZATION REPLACEMENT WITHDRAWN, BLOCKED.
-- Neither SECURITY DEFINER current_user nor current_setting('role') alone
-- authenticates an API caller. No function definition is replaced in this draft.
-- Required successor boundary: a trusted Supabase/PostgREST JWT-validated
-- request carrying auth.uid(), authorized against owner / CURRENT approved
-- employee / protected platform-admin identity, with p_user_id bound to caller.
-- JWT/session settings are trusted ONLY behind that verified API boundary;
-- they are not proof against arbitrary SQL clients that can set GUCs.
-- No-JWT callers must fail closed unless a distinct trusted execution path
-- (restricted SQL principal or server handler) is actually verified and approved.
-- Existing import confirmation/correction supply auth.uid() and call the
-- canonical RPC; preserve signature, financial/lock/ledger logic and ACLs.
-- A full-source replacement proposal requires exact canonical old source,
-- exactly-one authorization block match, expected resulting full source,
-- unchanged pg_proc identity/owner/security/argument defaults/ACLs, and
-- post-definition checks inside one transaction. MD5 + strpos is insufficient.
-- Do not reconstruct the full live body from local migration timestamps.
REVOKE EXECUTE ON FUNCTION public.reverse_inventory_action(uuid) FROM PUBLIC, anon;
-- Other reviewed inventory/import RPCs already deny anon/PUBLIC; preserve
-- existing authenticated/service EXECUTE. Do not add billing gates here.

-- Additional postconditions for a future approved successor, not evidence
-- that this deliberately gated draft has been executed or tested.
-- No broad grant restoration: assert the complete allowed column set and all
-- forbidden table capabilities, including inherited/PUBLIC permissions.
DO $complete_acl_and_policies$
DECLARE v_role text; v_relation regclass; v_cap text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH v_relation IN ARRAY ARRAY['public.user_businesses'::regclass,'public.business_users'::regclass] LOOP
      FOREACH v_cap IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(v_role,v_relation,v_cap) THEN
          RAISE EXCEPTION 'Unexpected effective membership table capability: %, %, %',v_role,v_relation,v_cap;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute a
    WHERE a.attrelid IN ('public.user_businesses'::regclass,'public.business_users'::regclass)
      AND a.attnum>0 AND NOT a.attisdropped
      AND (has_column_privilege('authenticated',a.attrelid,a.attname,'INSERT')
        IS DISTINCT FROM (a.attname IN ('user_id','business_id','role')
          OR (a.attrelid='public.business_users'::regclass AND a.attname='status'))
        OR has_column_privilege('authenticated',a.attrelid,a.attname,'UPDATE')
        IS DISTINCT FROM (a.attname='role'
          OR (a.attrelid='public.business_users'::regclass AND a.attname='status')))) THEN
    RAISE EXCEPTION 'Effective membership columns differ from exact candidate allowlist';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid IN
    ('public.user_businesses'::regclass,'public.business_users'::regclass)
    AND polcmd IN ('a','w','d','*')) <> 4
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN
      ('public.user_businesses'::regclass,'public.business_users'::regclass)
      AND polcmd IN ('a','w','d','*') AND polname NOT IN
        ('t1bs_user_businesses_owner_insert','t1bs_user_businesses_owner_update',
         't1bs_business_users_request_or_owner_insert','t1bs_business_users_owner_update')) THEN
    RAISE EXCEPTION 'Alternative membership write policy remains';
  END IF;
END;
$complete_acl_and_policies$;

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