-- UNAPPLIED. Do not copy into supabase/migrations and do not run on production.
-- Isolated database only, after a confirmed backup of that target.
--
-- Closes direct client inserts into public.user_businesses.
-- Owner membership for a new business stays inside create_business_for_new_user,
-- which is SECURITY DEFINER and owned by postgres. FORCE RLS is off, so that
-- function still inserts. Existing rows, the user_id primary key, SELECT, and
-- the owner UPDATE policy are left as they are.
--
-- This is the only membership-lock candidate. Do not add a second one.
-- Deployment order for the hardening package:
--   1. Confirm a backup of the target. Production PITR is UNVERIFIED from here.
--   2. Run this file alone. Do not combine it with other unapplied packages.
--   3. Run docs/v2/user-businesses-insert-lock.disposable.NOTRUN.sql on a
--      disposable copy. That file rolls back.
--   4. Then docs/v2/inventory-reversal.UNAPPLIED.sql on that same isolated target.
--      That file is one transaction. A preflight failure rolls the whole file back.
--   5. docs/v2/out-of-stock-dedup.UNAPPLIED.sql stays blocked until its preflight passes.
--   6. Production application is a separate approval after those tests pass.
--
-- Older installed clients: this repository has no app-shell service worker.
-- Onboarding calls create_business_for_new_user. Join requests write
-- business_users with status pending. A cached page that still calls the RPC
-- keeps working. A direct insert from any client starts failing closed.
--
-- Rollback, only if this file was applied and onboarding must be reverted:
--   GRANT INSERT ON TABLE public.user_businesses TO anon, authenticated;
--   CREATE POLICY "Users can create their own business relationships"
--     ON public.user_businesses FOR INSERT TO public
--     WITH CHECK (user_id = auth.uid());

BEGIN;

DO $preflight$
DECLARE
  v_def text;
BEGIN
  IF to_regclass('public.user_businesses') IS NULL THEN
    RAISE EXCEPTION 'user_businesses is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.user_businesses'::regclass
      AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (user_id)'
  ) THEN
    RAISE EXCEPTION 'user_businesses primary key is not (user_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.user_businesses'::regclass
      AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'FORCE RLS is on; review the definer insert before revoking client INSERT';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'public'
    AND p.proname = 'create_business_for_new_user'
    AND p.prosecdef
    AND r.rolname = 'postgres';

  IF v_def IS NULL OR v_def NOT ILIKE '%INSERT INTO public.user_businesses%' THEN
    RAISE EXCEPTION 'create_business_for_new_user is not a postgres SECURITY DEFINER function that inserts user_businesses';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) THEN
    RAISE EXCEPTION 'anon or authenticated role is missing';
  END IF;
END;
$preflight$;

DROP POLICY IF EXISTS "Users can create their own business relationships" ON public.user_businesses;

REVOKE INSERT ON TABLE public.user_businesses FROM PUBLIC;
REVOKE INSERT ON TABLE public.user_businesses FROM anon;
REVOKE INSERT ON TABLE public.user_businesses FROM authenticated;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = 'public.user_businesses'::regclass
      AND p.polcmd = 'a'
  ) THEN
    RAISE EXCEPTION 'An INSERT policy remains on user_businesses';
  END IF;

  IF has_table_privilege('anon', 'public.user_businesses', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_businesses', 'INSERT')
     OR has_table_privilege('public', 'public.user_businesses', 'INSERT') THEN
    RAISE EXCEPTION 'INSERT remains granted to anon, authenticated, or PUBLIC';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.user_businesses', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.user_businesses', 'UPDATE') THEN
    RAISE EXCEPTION 'SELECT or UPDATE for authenticated was not preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.user_businesses'::regclass
      AND polname = 'Users can view their own business relationships'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.user_businesses'::regclass
      AND polname = 'Business owners can update member roles'
  ) THEN
    RAISE EXCEPTION 'SELECT or owner UPDATE policy is missing';
  END IF;
END;
$verify$;

COMMIT;
