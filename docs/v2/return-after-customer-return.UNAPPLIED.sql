-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute on production.
-- Does not replace reverse_inventory_action or reverse_quick_sale.
-- A customer return already restored some or all of the sold units.
-- The current reversal functions restore the whole movement, so any later
-- reversal would credit those units again. This trigger rejects that reversal
-- inside the same transaction, which rolls the stock change back.
-- A partial reversal of only the units still outstanding is not represented
-- by the current functions. It stays closed rather than restoring the full sale.
-- Duplicate reversal remains the existing "already reversed" result.
-- Existing rows are not updated.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.inventory_reversal_respects_returns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
DECLARE
  v_action uuid;
  v_returned integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_reversal, false) IS DISTINCT FROM true OR NEW.reverses_action_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_action := NEW.reverses_action_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.reversed_at IS NOT NULL OR NEW.reversed_at IS NULL OR COALESCE(NEW.is_reversal, false) THEN
      RETURN NEW;
    END IF;
    v_action := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE((r.reference_meta->>'units')::integer, 0)), 0)
    INTO v_returned
  FROM public.inventory_actions r
  WHERE r.business_id = NEW.business_id
    AND r.reference_type = 'customer_return'
    AND r.reference_meta->>'original_action_id' = v_action::text;

  IF v_returned > 0 THEN
    RAISE EXCEPTION 'reversal is closed after a customer return' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.inventory_reversal_respects_returns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_inventory_reversal_respects_returns_insert ON public.inventory_actions;
CREATE TRIGGER trg_inventory_reversal_respects_returns_insert
  BEFORE INSERT ON public.inventory_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_reversal_respects_returns();

DROP TRIGGER IF EXISTS trg_inventory_reversal_respects_returns_update ON public.inventory_actions;
CREATE TRIGGER trg_inventory_reversal_respects_returns_update
  BEFORE UPDATE OF reversed_at ON public.inventory_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_reversal_respects_returns();

COMMIT;
