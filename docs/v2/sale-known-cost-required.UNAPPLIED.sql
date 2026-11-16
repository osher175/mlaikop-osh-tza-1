-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute.
--
-- A new quick-sale line cannot be stored without products.cost.
-- Existing sale_lines with a null unit_cost_ils stay as they are.
-- Zero remains a known cost. Null is rejected and is not stored as zero.
-- complete_quick_sale inserts the line in the same transaction as the stock
-- decrease, so a rejected cost rolls the stock change back.
--
-- Apply after sale_lines exists and before V2_SALES_STACK_READY is turned on.
-- The client also refuses a null cost before it calls the RPC.
--
-- Rollback: drop the trigger and the function. Stored rows are not rewritten.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.sale_lines') IS NULL THEN
    RAISE EXCEPTION 'sale_lines is not present';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_lines' AND column_name = 'unit_cost_ils'
  ) THEN
    RAISE EXCEPTION 'sale_lines.unit_cost_ils is not present';
  END IF;
END;
$preconditions$;

CREATE OR REPLACE FUNCTION public.sale_lines_require_known_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $known_cost$
BEGIN
  IF NEW.unit_cost_ils IS NULL THEN
    RAISE EXCEPTION 'known cost is required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$known_cost$;

REVOKE ALL ON FUNCTION public.sale_lines_require_known_cost() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sale_lines_require_known_cost ON public.sale_lines;
CREATE TRIGGER trg_sale_lines_require_known_cost
  BEFORE INSERT ON public.sale_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.sale_lines_require_known_cost();

COMMIT;
