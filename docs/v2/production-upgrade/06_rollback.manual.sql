-- MANUAL ROLLBACK. DO NOT RUN AS PART OF THE UPGRADE.
-- Not in supabase/migrations.
--
-- Refuses when any employee, sale, or quick-sale movement exists.
-- Does not update products, prices, costs, quantities, or legacy sales.
-- Does not drop reservation objects from Task 1A.
-- Does not replace or drop reverse_inventory_action.
--
-- In the same session, before running this file:
--   SET mlaiko.confirm_unused_upgrade_rollback = 'yes';
-- Employees are dropped only when that table is empty and you also set:
--   SET mlaiko.confirm_drop_empty_employees = 'yes';

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $rollback$
DECLARE
  v_has boolean;
BEGIN
  IF current_setting('mlaiko.confirm_unused_upgrade_rollback', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'rollback refused: set mlaiko.confirm_unused_upgrade_rollback = yes in this session';
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.employees)' INTO v_has;
    IF v_has THEN RAISE EXCEPTION 'rollback refused: employees has rows'; END IF;
  END IF;
  IF to_regclass('public.sale_transactions') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.sale_transactions)' INTO v_has;
    IF v_has THEN RAISE EXCEPTION 'rollback refused: sale_transactions has rows'; END IF;
  END IF;
  IF to_regclass('public.sale_lines') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.sale_lines)' INTO v_has;
    IF v_has THEN RAISE EXCEPTION 'rollback refused: sale_lines has rows'; END IF;
  END IF;
  IF to_regclass('public.inventory_actions') IS NOT NULL THEN
    EXECUTE $q$SELECT EXISTS (SELECT 1 FROM public.inventory_actions WHERE reference_type = 'sale_transaction')$q$ INTO v_has;
    IF v_has THEN RAISE EXCEPTION 'rollback refused: quick-sale inventory movements exist'; END IF;
  END IF;

  IF to_regclass('public.inventory_actions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_quick_sale_movement ON public.inventory_actions;
  END IF;

  DROP FUNCTION IF EXISTS public.complete_quick_sale(uuid, uuid, uuid, text, jsonb);
  DROP FUNCTION IF EXISTS public.reverse_quick_sale(uuid, uuid);
  DROP FUNCTION IF EXISTS public.guard_quick_sale_movement();

  DROP TABLE IF EXISTS public.sale_lines;
  DROP TABLE IF EXISTS public.sale_transactions;

  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_business_id_id_key;
  END IF;
  IF to_regclass('public.inventory_actions') IS NOT NULL THEN
    ALTER TABLE public.inventory_actions DROP CONSTRAINT IF EXISTS inventory_actions_business_id_id_key;
  END IF;

  IF current_setting('mlaiko.confirm_drop_empty_employees', true) = 'yes'
     AND to_regclass('public.employees') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_task1a_employee_audit ON public.employees;
    DROP TABLE public.employees;
    DROP FUNCTION IF EXISTS public.task1a_employee_audit();
  END IF;
END;
$rollback$;

COMMIT;
