-- MANUAL RECOVERY. DO NOT RUN as part of the rollout.
-- Intentionally outside supabase/migrations.
-- Does not delete products, inventory rows, employees, or sales.
-- Does not change quantities, prices, costs, or historical attribution.
--
-- Run section 1 only to undo migration B and restore legacy sale writes.
-- Run section 2 only when migration A is still unused: every salesperson value
-- is null. If any new sale already stored an employee, section 2 refuses.

-- ---------------------------------------------------------------------------
-- Section 1. Undo enforcement. Migration A stays in place.
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TRIGGER IF EXISTS trg_guard_quick_sale_salesperson ON public.sale_transactions;
DROP FUNCTION IF EXISTS public.guard_quick_sale_salesperson();

ALTER TABLE public.sale_transactions
  ALTER COLUMN salesperson_employee_id DROP NOT NULL;

COMMENT ON COLUMN public.sale_transactions.salesperson_employee_id IS
  'Active employee of this business at confirmation, or NULL for an explicit unattributed sale. Never inventory_actions.user_id.';

CREATE OR REPLACE FUNCTION public.guard_inventory_sale_salesperson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salesperson_employee_id IS DISTINCT FROM OLD.salesperson_employee_id THEN
    RAISE EXCEPTION 'salesperson attribution is immutable and cannot be backfilled'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_inventory_sale_salesperson() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_inventory_sale_salesperson ON public.inventory_actions;
CREATE TRIGGER trg_guard_inventory_sale_salesperson
  BEFORE UPDATE ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_sale_salesperson();

-- complete_quick_sale keeps rejecting a null salesperson after this section.
-- That RPC is not on the legacy sale path. Leave it strict unless quick-sale
-- writes were enabled, in which case redeploy the frontend with
-- V2_SALES_STACK_READY false before considering a function restore.
-- Do not re-run docs/v2/production-upgrade/03_sale_functions.additive.sql:
-- that file skips work when the function already exists.

COMMIT;

-- ---------------------------------------------------------------------------
-- Section 2. Undo migration A. Refuses once any salesperson id is stored.
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $unused$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventory_actions
    WHERE salesperson_employee_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'refusing to drop salesperson attribution that is already stored';
  END IF;
END;
$unused$;

DROP TRIGGER IF EXISTS trg_guard_inventory_sale_salesperson ON public.inventory_actions;
DROP FUNCTION IF EXISTS public.guard_inventory_sale_salesperson();

ALTER TABLE public.inventory_actions
  DROP CONSTRAINT IF EXISTS inventory_actions_salesperson_employee_fkey;

DROP INDEX IF EXISTS public.inventory_actions_salesperson_idx;

ALTER TABLE public.inventory_actions
  DROP COLUMN IF EXISTS salesperson_employee_id;

COMMIT;
