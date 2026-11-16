-- UNAPPLIED. DO NOT EXECUTE.
-- Not in supabase/migrations. Do not copy it there until the approval gate in
-- docs/v2/production-upgrade/00_README.md is complete.
--
-- Additive employee directory for one business.
-- Creates public.employees only when that table is absent.
-- If Task 1A already created the same directory, this file checks the shape
-- and leaves every existing row untouched.
-- No sample employees. No sale backfill. No changes to products,
-- inventory_actions, prices, costs, or quantities.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $employees$
BEGIN
  IF to_regclass('public.businesses') IS NULL THEN
    RAISE EXCEPTION 'public.businesses is required';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_business_member(uuid,uuid) is required';
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    IF (
      SELECT count(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name IN ('id', 'business_id', 'display_name', 'is_active', 'created_by', 'created_at', 'updated_at')
    ) <> 7 THEN
      RAISE EXCEPTION 'public.employees exists but does not match the V2 directory';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'employees' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'public.employees exists without row level security';
    END IF;
    RAISE NOTICE 'public.employees already present; rows and policies were not changed';
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE TABLE public.employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
      display_name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_by uuid NOT NULL DEFAULT auth.uid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT employees_business_id_id_key UNIQUE (business_id, id),
      CONSTRAINT employees_display_name_check CHECK (
        display_name = btrim(display_name) AND length(display_name) BETWEEN 1 AND 120
      )
    );

    COMMENT ON TABLE public.employees IS
      'Business-scoped employee directory. Not an auth user and not a permission role. Deactivate instead of deleting. Sales reference this id from sale_transactions only.';

    REVOKE ALL ON public.employees FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON public.employees TO authenticated;
    GRANT INSERT (business_id, display_name, is_active) ON public.employees TO authenticated;
    GRANT UPDATE (display_name, is_active) ON public.employees TO authenticated;
    GRANT ALL ON public.employees TO service_role;

    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

    CREATE POLICY employees_member_read ON public.employees
      FOR SELECT TO authenticated
      USING (public.is_business_member(business_id, auth.uid()));

    CREATE POLICY employees_owner_insert ON public.employees
      FOR INSERT TO authenticated
      WITH CHECK (
        created_by = auth.uid()
        AND public.is_business_member(business_id, auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.businesses b
          WHERE b.id = business_id AND b.owner_id = auth.uid()
        )
      );

    CREATE POLICY employees_owner_update ON public.employees
      FOR UPDATE TO authenticated
      USING (
        public.is_business_member(business_id, auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.businesses b
          WHERE b.id = business_id AND b.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        public.is_business_member(business_id, auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.businesses b
          WHERE b.id = business_id AND b.owner_id = auth.uid()
        )
      );

    CREATE UNIQUE INDEX employees_business_display_name_uidx
      ON public.employees (business_id, lower(display_name));
    CREATE INDEX employees_active_lookup_idx
      ON public.employees (business_id, display_name) WHERE is_active;

    CREATE FUNCTION public.task1a_employee_audit()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
    AS $function$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.business_id IS DISTINCT FROM OLD.business_id
           OR NEW.created_by IS DISTINCT FROM OLD.created_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'Employee identity and creation audit are immutable';
        END IF;
      ELSE
        IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
          RAISE EXCEPTION 'Employee creator must be the authenticated actor' USING ERRCODE = '42501';
        END IF;
        IF public.is_business_member(NEW.business_id, NEW.created_by) IS DISTINCT FROM true THEN
          RAISE EXCEPTION 'Employee creator is not a business member' USING ERRCODE = '42501';
        END IF;
        NEW.created_at := now();
      END IF;
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $function$;

    REVOKE ALL ON FUNCTION public.task1a_employee_audit() FROM PUBLIC, anon, authenticated;
    CREATE TRIGGER trg_task1a_employee_audit
      BEFORE INSERT OR UPDATE ON public.employees
      FOR EACH ROW EXECUTE FUNCTION public.task1a_employee_audit();
  $ddl$;
END;
$employees$;

COMMIT;
