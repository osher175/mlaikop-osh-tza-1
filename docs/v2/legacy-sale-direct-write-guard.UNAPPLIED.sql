-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- There is no service worker and no client-version table. A cached page keeps
-- the old sale write: it lowers products.quantity, then inserts inventory_actions.
-- This guard closes that browser path. record_legacy_sale, complete_quick_sale,
-- reverse_inventory_action, reverse_quick_sale, and execute_inventory_transaction
-- still change stock because they are SECURITY DEFINER functions owned by the
-- migration role, not by authenticated.
--
-- Apply only after docs/v2/legacy-sale-atomic.UNAPPLIED.sql is applied and the
-- deployed client calls record_legacy_sale. The function check below is
-- necessary and not sufficient: this file cannot see which JavaScript bundle
-- the browser has loaded. Applying it earlier blocks every browser stock
-- decrease, including the current sale dialog.
--
-- A products.quantity decrease from the browser role cannot be told apart
-- from the old sale write. The guard therefore closes every browser decrease.
-- It does not close a trusted stock function.
--
-- After this file:
--   * A cached sale page fails on the quantity update. Stock stays unchanged
--     and the sale row is not inserted. The page cannot insert sale_total_ils.
--   * execute_inventory_transaction('adjust') remains the authorized stock
--     correction. It writes no sale amount, so it is not revenue.
--   * Import receipts, quick sales, legacy atomic sales, and both reversal
--     RPCs remain functional. They run as the function owner.
--   * Browser purchases and other quantity increases still work.
--   * Browser product edits that do not change quantity still work.
--   * A browser return that only increases stock still works. A decrease has
--     to go through a trusted function. There is no separate return type.
--
-- Dropping the trigger restores the old browser writes. It does not rewrite
-- rows. Migration B stays a later, separate file.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  v_owner text;
BEGIN
  IF to_regprocedure('public.record_legacy_sale(uuid,uuid,integer,numeric,uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'apply docs/v2/legacy-sale-atomic.UNAPPLIED.sql before this guard';
  END IF;
  IF to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NULL
     OR to_regprocedure('public.reverse_inventory_action(uuid)') IS NULL
     OR to_regprocedure('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'trusted stock functions must already exist';
  END IF;
  SELECT r.rolname INTO v_owner
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'public'
    AND p.proname = 'record_legacy_sale'
    AND pg_get_function_identity_arguments(p.oid) = 'p_business_id uuid, p_product_id uuid, p_quantity integer, p_sale_total_ils numeric, p_idempotency_key uuid, p_notes text, p_salesperson_employee_id uuid';
  IF v_owner IS NULL OR v_owner IN ('authenticated', 'anon', 'authenticator') THEN
    RAISE EXCEPTION 'record_legacy_sale must be owned by the migration role, not the browser role';
  END IF;
END;
$preconditions$;

CREATE OR REPLACE FUNCTION public.guard_direct_stock_decrease()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.quantity IS DISTINCT FROM OLD.quantity
     AND NEW.quantity < OLD.quantity
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'direct stock decrease is closed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_direct_stock_decrease() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_direct_stock_decrease ON public.products;
CREATE TRIGGER trg_guard_direct_stock_decrease
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_direct_stock_decrease();

CREATE OR REPLACE FUNCTION public.guard_direct_financial_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
BEGIN
  IF TG_OP = 'INSERT'
     AND COALESCE(NEW.is_reversal, false) = false
     AND NEW.sale_total_ils IS NOT NULL
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'direct financial sale insert is closed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_direct_financial_sale() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_direct_financial_sale ON public.inventory_actions;
CREATE TRIGGER trg_guard_direct_financial_sale
  BEFORE INSERT ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_direct_financial_sale();

COMMENT ON FUNCTION public.guard_direct_stock_decrease() IS
  'Blocks a browser quantity decrease. Trusted SECURITY DEFINER stock functions keep working. Unapplied until the atomic sale client is deployed.';

COMMIT;
