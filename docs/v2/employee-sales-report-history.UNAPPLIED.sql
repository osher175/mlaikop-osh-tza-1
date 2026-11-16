-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute on production.
-- Replaces employee_sales_report. Read-only. Does not update sales, stock, or employees.
-- Adds historical product-editor sales (reference_type editor_operation) as
-- unattributed when salesperson_employee_id is null. inventory_actions.user_id
-- is never copied into the employee id.
-- Revenue is VAT-inclusive. Profit is ex-VAT revenue minus known unit cost.
-- A null cost is excluded from profit and is not treated as zero.
-- An explicit 0 is a known cost. Reversed sales are excluded.
-- A customer return is not revenue and does not increase profit.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regprocedure('public.can_access_business_analytics(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'can_access_business_analytics is required';
  END IF;
  IF to_regclass('public.sale_lines') IS NULL OR to_regclass('public.sale_transactions') IS NULL THEN
    RAISE EXCEPTION 'sale tables are required';
  END IF;
  IF to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'inventory_actions is required';
  END IF;
END;
$preconditions$;

CREATE OR REPLACE FUNCTION public.employee_sales_report(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $report$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR public.can_access_business_analytics(p_business_id, auth.uid()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'invalid report range';
  END IF;

  WITH lines AS (
    SELECT t.salesperson_employee_id AS employee_id,
           t.id AS transaction_id,
           l.line_revenue_gross_ils AS gross,
           l.quantity AS units,
           l.unit_cost_ils AS unit_cost
    FROM public.sale_lines l
    JOIN public.sale_transactions t
      ON t.id = l.transaction_id AND t.business_id = l.business_id
    WHERE l.business_id = p_business_id
      AND t.status = 'completed'
      AND t.reversed_at IS NULL
      AND t.sold_at >= p_from
      AND t.sold_at < p_to
    UNION ALL
    SELECT ia.salesperson_employee_id,
           ia.id,
           ia.sale_total_ils,
           ABS(ia.quantity_changed),
           ia.cost_snapshot_ils
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.reference_type IN ('legacy_sale_request', 'editor_operation')
      AND ia.action_type IN ('remove', 'sale')
      AND ia.sale_total_ils IS NOT NULL
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND ia.timestamp >= p_from
      AND ia.timestamp < p_to
  ), priced AS (
    SELECT *,
           CASE WHEN unit_cost IS NULL THEN NULL
                ELSE round(gross / 1.18, 2) - round(unit_cost * units, 2) END AS profit,
           round(gross, 2) - round(gross / 1.18, 2) AS vat
    FROM lines
  ), employees AS (
    SELECT employee_id,
           round(COALESCE(SUM(gross), 0), 2) AS revenue_gross,
           CASE WHEN COUNT(profit) = 0 THEN NULL ELSE round(SUM(profit), 2) END AS gross_profit,
           COALESCE(SUM(units), 0)::integer AS units,
           COUNT(DISTINCT transaction_id)::integer AS transactions,
           round(COALESCE(SUM(gross) FILTER (WHERE unit_cost IS NULL), 0), 2) AS unknown_cost_revenue
    FROM priced
    WHERE employee_id IS NOT NULL
    GROUP BY employee_id
  ), unattributed AS (
    SELECT round(COALESCE(SUM(gross), 0), 2) AS revenue_gross,
           CASE WHEN COUNT(profit) = 0 THEN NULL ELSE round(SUM(profit), 2) END AS gross_profit,
           COALESCE(SUM(units), 0)::integer AS units,
           COUNT(DISTINCT transaction_id)::integer AS transactions,
           round(COALESCE(SUM(gross) FILTER (WHERE unit_cost IS NULL), 0), 2) AS unknown_cost_revenue
    FROM priced
    WHERE employee_id IS NULL
  ), totals AS (
    SELECT round(COALESCE(SUM(gross), 0), 2) AS revenue_gross,
           CASE WHEN COUNT(profit) = 0 THEN NULL ELSE round(SUM(profit), 2) END AS gross_profit,
           round(COALESCE(SUM(vat), 0), 2) AS vat,
           round(COALESCE(SUM(gross) FILTER (WHERE unit_cost IS NULL), 0), 2) AS unknown_cost_revenue,
           COALESCE(SUM(units), 0)::integer AS units,
           COUNT(DISTINCT transaction_id)::integer AS transactions
    FROM priced
  ), returns AS (
    SELECT COALESCE(SUM(COALESCE((reference_meta->>'units')::integer, 0)), 0)::integer AS units
    FROM public.inventory_actions
    WHERE business_id = p_business_id
      AND reference_type = 'customer_return'
      AND timestamp >= p_from
      AND timestamp < p_to
  )
  SELECT jsonb_build_object(
    'revenue_gross', totals.revenue_gross,
    'gross_profit', totals.gross_profit,
    'vat', totals.vat,
    'unknown_cost_revenue', totals.unknown_cost_revenue,
    'units', totals.units,
    'transactions', totals.transactions,
    'customer_return_units', returns.units,
    'unattributed', jsonb_build_object(
      'revenue_gross', unattributed.revenue_gross,
      'gross_profit', unattributed.gross_profit,
      'units', unattributed.units,
      'transactions', unattributed.transactions,
      'unknown_cost_revenue', unattributed.unknown_cost_revenue
    ),
    'employees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'employee_id', employee_id,
        'revenue_gross', revenue_gross,
        'gross_profit', gross_profit,
        'units', units,
        'transactions', transactions,
        'unknown_cost_revenue', unknown_cost_revenue
      ) ORDER BY employee_id::text)
      FROM employees
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM totals, returns, unattributed;
  RETURN v_result;
END;
$report$;

REVOKE ALL ON FUNCTION public.employee_sales_report(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employee_sales_report(uuid, timestamptz, timestamptz) TO authenticated;

COMMIT;
