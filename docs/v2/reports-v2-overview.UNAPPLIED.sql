-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Does not replace reports_aggregate and does not attach a trigger.
-- The live function still values missing cost as zero. This function does not.
-- Quick-sale list-price columns are not read; those discounts stay unknown.
-- There is no branch column. Aging stays null until fifo-inventory-lots is applied
-- and a later approved reader is added. This file does not create lots.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.v2_reports_overview(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_product_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.can_access_business_analytics(p_business_id, auth.uid()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  WITH sales AS (
    SELECT ia.timestamp AS sold_at, ia.product_id, p.name AS product_name,
           ia.sale_total_ils AS gross, ia.cost_snapshot_ils AS cost,
           ABS(ia.quantity_changed)::numeric AS qty,
           ia.list_unit_ils, ia.discount_ils, ia.reference_type
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id AND p.business_id = ia.business_id
    WHERE auth.uid() IS NOT NULL
      AND public.can_access_business_analytics(p_business_id, auth.uid())
      AND ia.business_id = p_business_id
      AND ia.timestamp >= p_from AND ia.timestamp < p_to
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
      AND ia.sale_total_ils IS NOT NULL
      AND ia.action_type IN ('remove', 'sale')
      AND (p_product_id IS NULL OR ia.product_id = p_product_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
    UNION ALL
    SELECT st.sold_at, sl.product_id, p.name,
           sl.line_revenue_gross_ils, sl.unit_cost_ils, sl.quantity::numeric,
           NULL::numeric, NULL::numeric, 'sale_line_pending'
    FROM public.sale_lines sl
    JOIN public.sale_transactions st
      ON st.id = sl.transaction_id AND st.business_id = sl.business_id
    JOIN public.products p ON p.id = sl.product_id AND p.business_id = sl.business_id
    WHERE public.can_access_business_analytics(p_business_id, auth.uid())
      AND sl.business_id = p_business_id
      AND st.status = 'completed' AND st.reversed_at IS NULL
      AND st.sold_at >= p_from AND st.sold_at < p_to
      AND (p_product_id IS NULL OR sl.product_id = p_product_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND (p_supplier_id IS NULL OR p.supplier_id = p_supplier_id)
  ), marked AS (
    SELECT *,
      (cost IS NOT NULL AND (
        reference_type IN ('legacy_sale_request', 'sale_line_pending') OR cost > 0
      )) AS cost_known,
      (
        discount_ils IS NOT NULL AND list_unit_ils IS NOT NULL
        AND reference_type IS DISTINCT FROM 'sale_transaction'
        AND reference_type IS DISTINCT FROM 'sale_line_pending'
        AND NOT (
          reference_type IS DISTINCT FROM 'legacy_sale_request'
          AND list_unit_ils = 0 AND discount_ils = 0
        )
      ) AS discount_known
    FROM sales
  ), totals AS (
    SELECT
      COALESCE(SUM(gross), 0) AS revenue_gross,
      COALESCE(SUM(gross / 1.18) FILTER (WHERE cost_known), 0) AS known_net,
      COALESCE(SUM(cost * qty) FILTER (WHERE cost_known), 0) AS known_cost,
      COUNT(*) FILTER (WHERE cost_known) AS cost_known_lines,
      COUNT(*) AS sale_lines,
      COALESCE(SUM(discount_ils) FILTER (WHERE discount_known), 0) AS verified_discount,
      COUNT(*) FILTER (WHERE discount_known AND discount_ils = 0) AS full_price_rows,
      COUNT(*) FILTER (WHERE discount_known AND discount_ils > 0) AS discounted_rows,
      COUNT(*) FILTER (WHERE NOT discount_known) AS unknown_discount_rows
    FROM marked
  ), timeline AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'day', day, 'revenue_gross', revenue_gross, 'gross_profit', gross_profit
    ) ORDER BY day), '[]'::jsonb) AS rows
    FROM (
      SELECT to_char(sold_at AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS day,
             SUM(gross) AS revenue_gross,
             SUM(gross / 1.18 - cost * qty) FILTER (WHERE cost_known) AS gross_profit
      FROM marked
      GROUP BY 1
    ) days
  ), top_products AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', product_id, 'product_name', product_name,
      'quantity', quantity, 'gross_profit', gross_profit
    )), '[]'::jsonb) AS rows
    FROM (
      SELECT product_id, product_name, SUM(qty) AS quantity,
             SUM(gross / 1.18 - cost * qty) FILTER (WHERE cost_known) AS gross_profit
      FROM marked
      GROUP BY product_id, product_name
      HAVING COUNT(*) FILTER (WHERE cost_known) > 0
      ORDER BY 4 DESC NULLS LAST
      LIMIT 20
    ) ranked
  ), stock AS (
    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE quantity > 0), 0) AS units,
      COALESCE(SUM(quantity) FILTER (WHERE quantity > 0 AND (cost IS NULL OR cost <= 0)), 0) AS unknown_cost_units,
      SUM(quantity * cost) FILTER (WHERE quantity > 0 AND cost IS NOT NULL AND cost > 0) AS known_value
    FROM public.products
    WHERE business_id = p_business_id
      AND public.can_access_business_analytics(p_business_id, auth.uid())
      AND (p_product_id IS NULL OR id = p_product_id)
      AND (p_brand_id IS NULL OR brand_id = p_brand_id)
      AND (p_supplier_id IS NULL OR supplier_id = p_supplier_id)
  ), receipts AS (
    SELECT COALESCE(SUM(ia.quantity_changed), 0) AS units,
           SUM(ia.quantity_changed * ia.purchase_unit_ils) FILTER (WHERE ia.purchase_unit_ils IS NOT NULL) AS known_cost
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id AND p.business_id = ia.business_id
    WHERE ia.business_id = p_business_id
      AND public.can_access_business_analytics(p_business_id, auth.uid())
      AND ia.action_type = 'add'
      AND ia.sale_total_ils IS NULL
      AND ia.timestamp >= p_from AND ia.timestamp < p_to
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
      AND (p_product_id IS NULL OR ia.product_id = p_product_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND (p_supplier_id IS NULL OR ia.supplier_id = p_supplier_id OR p.supplier_id = p_supplier_id)
  ), imports AS (
    SELECT COALESCE(SUM(amount_ils) FILTER (WHERE payment_status = 'paid'), 0) AS paid_ils,
           COUNT(*) FILTER (
             WHERE payment_status IS DISTINCT FROM 'paid' AND payment_status IS DISTINCT FROM 'cancelled'
           ) AS open_rows
    FROM public.import_payments
    WHERE business_id = p_business_id
      AND public.can_access_business_analytics(p_business_id, auth.uid())
      AND payment_date >= (p_from AT TIME ZONE 'Asia/Jerusalem')::date
      AND payment_date < (p_to AT TIME ZONE 'Asia/Jerusalem')::date
  )
  SELECT jsonb_build_object(
    'revenue_gross', totals.revenue_gross,
    'gross_profit', CASE WHEN totals.cost_known_lines = 0 THEN NULL ELSE round(totals.known_net - totals.known_cost, 2) END,
    'margin_pct', CASE
      WHEN totals.cost_known_lines = 0 OR totals.known_net = 0 THEN NULL
      ELSE round(((totals.known_net - totals.known_cost) / totals.known_net) * 100, 2)
    END,
    'cost_known_lines', totals.cost_known_lines,
    'sale_lines', totals.sale_lines,
    'verified_discount', totals.verified_discount,
    'full_price_rows', totals.full_price_rows,
    'discounted_rows', totals.discounted_rows,
    'unknown_discount_rows', totals.unknown_discount_rows,
    'inventory_value_known', stock.known_value,
    'inventory_units', stock.units,
    'inventory_unknown_cost_units', stock.unknown_cost_units,
    'timeline', timeline.rows,
    'top_products', top_products.rows,
    'receipt_units', receipts.units,
    'receipt_known_cost', receipts.known_cost,
    'import_paid_ils', CASE WHEN p_product_id IS NULL AND p_brand_id IS NULL AND p_supplier_id IS NULL THEN imports.paid_ils ELSE NULL END,
    'import_open_rows', CASE WHEN p_product_id IS NULL AND p_brand_id IS NULL AND p_supplier_id IS NULL THEN imports.open_rows ELSE NULL END,
    'aging', NULL
  )
  INTO v_result
  FROM totals, timeline, top_products, stock, receipts, imports;
  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_reports_overview(uuid, timestamptz, timestamptz, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_reports_overview(uuid, timestamptz, timestamptz, uuid, uuid, uuid) TO authenticated, service_role;

COMMIT;
