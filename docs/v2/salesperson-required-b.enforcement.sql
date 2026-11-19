-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Migration B of 2. Apply only after:
--   1. docs/v2/salesperson-required-a.additive.sql has committed.
--   2. The deployed frontend sends an active employee on every new legacy sale.
--   3. Stale browser bundles that still omit the employee have been refreshed,
--      or a short sale-write interruption for those tabs is accepted.
--
-- This file rejects a new financial sale with no salesperson. It does not
-- update existing rows. If any quick sale already has a null salesperson,
-- the transaction aborts and changes nothing.
--
-- complete_quick_sale is not replaced. Production already rejects a missing
-- salesperson and stores the list price. Replacing that function here would
-- risk dropping a later sale-body change. record_legacy_sale is not replaced
-- either. Its default null argument is closed by the inventory_actions
-- trigger: a new row with sale_total_ils and no active employee of that
-- business rolls back, including a cached bundle that still omits the employee.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.employees') IS NULL
     OR to_regclass('public.sale_transactions') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'migration B requires the applied employee and sale tables';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'salesperson_employee_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'apply salesperson-required-a.additive.sql first';
  END IF;
  IF to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'complete_quick_sale is not deployed';
  END IF;
  IF to_regprocedure('public.record_legacy_sale(uuid,uuid,integer,numeric,uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'record_legacy_sale is not deployed';
  END IF;
  IF position('salesperson is required' IN (
       SELECT pg_get_functiondef(p.oid)
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'complete_quick_sale'
     )) = 0
     OR position('e.business_id = p_business_id' IN (
       SELECT pg_get_functiondef(p.oid)
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'complete_quick_sale'
     )) = 0 THEN
    RAISE EXCEPTION 'complete_quick_sale does not already require this business salesperson';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sale_transactions WHERE salesperson_employee_id IS NULL
  ) THEN
    RAISE EXCEPTION 'existing quick sales have no salesperson; this migration does not rewrite them';
  END IF;
END;
$preconditions$;

CREATE OR REPLACE FUNCTION public.guard_inventory_sale_salesperson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
DECLARE
  v_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salesperson_employee_id IS DISTINCT FROM OLD.salesperson_employee_id THEN
    RAISE EXCEPTION 'salesperson attribution is immutable and cannot be backfilled'
      USING ERRCODE = '42501';
  END IF;

  -- sale_total_ils is the financial-sale marker. Quick-sale movements leave it
  -- null, so they are not a second sale. Reversals, intake, corrections, and
  -- import adjustments also stay allowed.
  IF TG_OP = 'INSERT'
     AND COALESCE(NEW.is_reversal, false) = false
     AND NEW.sale_total_ils IS NOT NULL THEN
    IF NEW.salesperson_employee_id IS NULL THEN
      RAISE EXCEPTION 'salesperson is required' USING ERRCODE = '23502';
    END IF;
    SELECT e.is_active INTO v_active
    FROM public.employees e
    WHERE e.id = NEW.salesperson_employee_id
      AND e.business_id = NEW.business_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'salesperson must be an active employee of this business'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_inventory_sale_salesperson() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_inventory_sale_salesperson ON public.inventory_actions;
CREATE TRIGGER trg_guard_inventory_sale_salesperson
  BEFORE INSERT OR UPDATE ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_sale_salesperson();

CREATE OR REPLACE FUNCTION public.guard_quick_sale_salesperson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
DECLARE
  v_active boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salesperson_employee_id IS DISTINCT FROM OLD.salesperson_employee_id THEN
    RAISE EXCEPTION 'salesperson attribution is immutable and cannot be backfilled'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.salesperson_employee_id IS NULL THEN
      RAISE EXCEPTION 'salesperson is required' USING ERRCODE = '23502';
    END IF;
    SELECT e.is_active INTO v_active
    FROM public.employees e
    WHERE e.id = NEW.salesperson_employee_id
      AND e.business_id = NEW.business_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'salesperson must be an active employee of this business'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_quick_sale_salesperson() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_quick_sale_salesperson ON public.sale_transactions;
CREATE TRIGGER trg_guard_quick_sale_salesperson
  BEFORE INSERT OR UPDATE ON public.sale_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_quick_sale_salesperson();

ALTER TABLE public.sale_transactions
  ALTER COLUMN salesperson_employee_id SET NOT NULL;

COMMENT ON COLUMN public.sale_transactions.salesperson_employee_id IS
  'Required active employee for every new quick sale. Existing rows were already non-null or this migration aborted. Not backfilled.';

COMMENT ON COLUMN public.inventory_actions.salesperson_employee_id IS
  'Required for a new row that has sale_total_ils and is not a reversal. NULL remains valid for historical sales, stock intake, corrections, and reversals. Not inventory_actions.user_id.';

-- complete_quick_sale stays as deployed. The precheck above refuses to
-- continue unless that live function already requires a salesperson in this
-- business. This file does not issue a new GRANT and does not rewrite the
-- function body.

COMMIT;
