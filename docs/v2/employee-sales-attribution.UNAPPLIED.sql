-- UNAPPLIED. DO NOT EXECUTE. NOT AN APPROVED MIGRATION.
-- Intentionally outside supabase/migrations so the migration tool cannot
-- deploy this preparation-only proposal.
--
-- SUPERSEDED. DO NOT APPLY.
-- The ordered replacement is salesperson-required-a.additive.sql, then the
-- frontend, then salesperson-required-b.enforcement.sql.
-- This file allows a null salesperson and must not be applied.
-- Historical sales are not backfilled.
--
-- F1 employee sales attribution.
-- Depends on the still-unapplied Task 1A table public.employees
-- (docs/task-1a/01_additive_foundation.proposed.sql). This file does not
-- create employees and does not backfill historical sales from user_id.
-- user_id remains the authenticated actor who recorded the inventory movement.
--
-- The live reverse_inventory_action INSERT lists its columns explicitly and
-- does not copy this new nullable column. That is safe: a reversal is excluded
-- from dashboard totals by is_reversal, and the original sale is excluded by
-- reversed_at. This proposal does not replace that function.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION 'F1 requires the unapplied Task 1A public.employees table';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'salesperson_employee_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'salesperson_employee_id already exists';
  END IF;
END;
$preconditions$;

ALTER TABLE public.inventory_actions
  ADD COLUMN salesperson_employee_id uuid NULL;

-- Same business as the sale. A salesperson from another business cannot be stored.
ALTER TABLE public.inventory_actions
  ADD CONSTRAINT inventory_actions_salesperson_employee_fkey
  FOREIGN KEY (business_id, salesperson_employee_id)
  REFERENCES public.employees (business_id, id)
  ON DELETE RESTRICT;

COMMENT ON COLUMN public.inventory_actions.salesperson_employee_id IS
  'Employee responsible for this sale, captured at sale time. NULL means unattributed. Not inventory_actions.user_id. Historical rows stay NULL.';

CREATE INDEX inventory_actions_salesperson_idx
  ON public.inventory_actions (business_id, salesperson_employee_id, timestamp)
  WHERE salesperson_employee_id IS NOT NULL;

CREATE FUNCTION public.f1_guard_salesperson_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salesperson_employee_id IS DISTINCT FROM OLD.salesperson_employee_id THEN
    RAISE EXCEPTION 'Salesperson attribution is immutable and cannot be backfilled'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.salesperson_employee_id IS NOT NULL THEN
    SELECT e.is_active INTO v_active
    FROM public.employees e
    WHERE e.id = NEW.salesperson_employee_id
      AND e.business_id = NEW.business_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Salesperson must be an active employee of this business'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.f1_guard_salesperson_attribution() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_f1_salesperson_attribution
  BEFORE INSERT OR UPDATE ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.f1_guard_salesperson_attribution();

COMMIT;
