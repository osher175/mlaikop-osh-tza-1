-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
-- Does not update inventory_actions, products, sale_lines, or sale_transactions.
--
-- Contract:
--   sale_total_ils and line_revenue_gross_ils are VAT-inclusive revenue.
--   Gross profit uses VAT-exclusive revenue minus known cost.
--   Unknown cost is NULL. On a legacy_sale_request row, 0 is a real zero.
--   On every older inventory sale row, NULL and 0 stay unknown. Those rows
--   were written by the current client, which stores 0 when cost is missing.
--   This file does not rewrite them. Their revenue stays in the VAT-inclusive
--   total, and their profit is left out so a missing cost cannot inflate it.
--   A quick-sale line is counted once from sale_lines. Its stock row has no
--   sale_total_ils, so it is not added again.
--   Reversals and reversed rows stay out.
--
-- reports_aggregate gross_profit and net_profit both become that ex-VAT
-- known-cost profit. The screen still has two labels. There is no separate
-- operating-expense figure in this function.
--
-- yoy_financials uses the same split. bi_analytics_yearly and
-- insights_aggregate are replaced separately by
-- docs/v2/bi-insights-known-cost.UNAPPLIED.sql, which must run after this
-- file because it calls sale_cost_known. Neither file updates stored rows.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.sale_cost_known(p_cost numeric, p_reference_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $known$
  SELECT CASE
    WHEN p_reference_type = 'legacy_sale_request' THEN p_cost IS NOT NULL
    ELSE p_cost IS NOT NULL AND p_cost > 0
  END;
$known$;

REVOKE ALL ON FUNCTION public.sale_cost_known(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sale_cost_known(numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reports_aggregate(business_id uuid, date_from timestamp with time zone, date_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_added integer;
  total_removed integer;
  total_value numeric;
  gross_profit numeric;
  net_profit numeric;
  revenue_gross numeric;
  revenue_net numeric;
  cogs_total numeric;
  quick_gross numeric := 0;
  quick_profit numeric := 0;
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
  top_products_list jsonb := '[]'::jsonb;
  purchases_breakdown jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_access_business_analytics(reports_aggregate.business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(ia.quantity_changed), 0) INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0) INTO total_removed
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0)), 0) INTO total_value
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ia.sale_total_ils), 0) INTO revenue_gross
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  IF to_regclass('public.sale_lines') IS NOT NULL THEN
    SELECT COALESCE(SUM(l.line_revenue_gross_ils), 0),
           COALESCE(SUM(l.line_revenue_net_ils - l.line_cost_ex_vat_ils) FILTER (WHERE l.unit_cost_ils IS NOT NULL), 0)
      INTO quick_gross, quick_profit
    FROM public.sale_lines l
    JOIN public.sale_transactions t
      ON t.id = l.transaction_id AND t.business_id = l.business_id
    WHERE l.business_id = reports_aggregate.business_id
      AND t.status = 'completed'
      AND t.sold_at >= date_from AND t.sold_at < date_to + interval '1 second';
  END IF;

  revenue_gross := revenue_gross + quick_gross;
  revenue_net := revenue_gross / 1.18;

  SELECT COALESCE(SUM(ia.cost_snapshot_ils * ABS(ia.quantity_changed)), 0) INTO cogs_total
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM((ia.sale_total_ils / 1.18) - ia.cost_snapshot_ils * ABS(ia.quantity_changed)), 0)
    INTO gross_profit
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  gross_profit := gross_profit + quick_profit;
  net_profit := ROUND(gross_profit, 2);

  SELECT p.name INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO suppliers_breakdown
  FROM (
    SELECT s.id as supplier_id, COALESCE(s.name, 'ללא ספק') as supplier_name,
           SUM(ia.quantity_changed) as total_purchased
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY s.id, s.name
    ORDER BY SUM(ia.quantity_changed) DESC
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO timeline_breakdown
  FROM (
    SELECT to_char(ia.timestamp, 'YYYY-MM-DD') as date,
           SUM(ABS(ia.quantity_changed)) as sales,
           COALESCE(SUM(ia.sale_total_ils), 0) as sales_amount
    FROM public.inventory_actions ia
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO top_products_list
  FROM (
    SELECT p.id as product_id, p.name as product_name,
           SUM(ABS(ia.quantity_changed)) as quantity_sold,
           COALESCE(SUM(ia.sale_total_ils), 0) as revenue
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY p.id, p.name
    ORDER BY SUM(ABS(ia.quantity_changed)) DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO purchases_breakdown
  FROM (
    SELECT to_char(ia.timestamp, 'YYYY-MM') as month,
           SUM(ia.quantity_changed) as quantity,
           COALESCE(SUM(ia.purchase_total_ils), SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0))) as amount
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY to_char(ia.timestamp, 'YYYY-MM')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM')
  ) t;

  RETURN jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', ROUND(gross_profit, 2),
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', suppliers_breakdown,
    'timeline_breakdown', timeline_breakdown,
    'top_products_list', top_products_list,
    'purchases_breakdown', purchases_breakdown
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.yoy_financials(
  p_business_id uuid,
  p_years integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz            constant text := 'Asia/Jerusalem';
  v_vat           constant numeric := 1.18;
  v_min_year      constant integer := 2020;
  v_current_year  integer;
  v_first_year    integer;
  v_range_start   timestamptz;
  v_range_end     timestamptz;
  v_years         jsonb;
  v_monthly       jsonb;
  v_comparisons   jsonb;
  v_cur_rev       numeric;
  v_cur_prof      numeric;
  v_cur_disc      numeric;
  v_prev_rev      numeric;
  v_prev_prof     numeric;
  v_prev_disc     numeric;
BEGIN
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  p_years := GREATEST(COALESCE(p_years, 3), 1);
  v_current_year := extract(year from (now() AT TIME ZONE v_tz))::int;
  v_first_year   := GREATEST(v_current_year - (p_years - 1), v_min_year);
  v_range_start := (make_timestamp(v_first_year, 1, 1, 0, 0, 0) AT TIME ZONE v_tz);
  v_range_end   := ((make_timestamp(v_current_year, 12, 31, 23, 59, 59) + interval '0.999 second') AT TIME ZONE v_tz);

  WITH scope AS (
    SELECT
      extract(year  from (ia.timestamp AT TIME ZONE v_tz))::int      AS y,
      extract(month from (ia.timestamp AT TIME ZONE v_tz))::int - 1  AS m,
      (ia.action_type IN ('remove','sale') AND ia.sale_total_ils IS NOT NULL) AS is_sale,
      (ia.action_type IN ('add','purchase') AND ia.purchase_total_ils IS NOT NULL) AS is_purchase,
      COALESCE(ia.sale_total_ils, 0) AS sale_total,
      COALESCE(ia.purchase_total_ils, 0) AS purchase_total,
      COALESCE(ia.discount_ils, 0) AS discount,
      public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type) AS cost_known,
      CASE WHEN public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN ia.cost_snapshot_ils * ABS(ia.quantity_changed) ELSE NULL END AS cogs,
      CASE WHEN public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN ia.sale_total_ils / v_vat ELSE NULL END AS known_net
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_range_start AND ia.timestamp <= v_range_end
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
      AND (
        (ia.action_type IN ('remove','sale') AND ia.sale_total_ils IS NOT NULL)
        OR (ia.action_type IN ('add','purchase') AND ia.purchase_total_ils IS NOT NULL)
      )
    UNION ALL
    SELECT
      extract(year  from (t.sold_at AT TIME ZONE v_tz))::int,
      extract(month from (t.sold_at AT TIME ZONE v_tz))::int - 1,
      true, false,
      l.line_revenue_gross_ils, 0::numeric, 0::numeric,
      l.unit_cost_ils IS NOT NULL,
      CASE WHEN l.unit_cost_ils IS NOT NULL THEN l.line_cost_ex_vat_ils ELSE NULL END,
      CASE WHEN l.unit_cost_ils IS NOT NULL THEN l.line_revenue_net_ils ELSE NULL END
    FROM public.sale_lines l
    JOIN public.sale_transactions t
      ON t.id = l.transaction_id AND t.business_id = l.business_id
    WHERE to_regclass('public.sale_lines') IS NOT NULL
      AND t.business_id = p_business_id
      AND t.status = 'completed'
      AND t.sold_at >= v_range_start AND t.sold_at <= v_range_end
  ),
  cells AS (
    SELECT
      g.y, g.m,
      COALESCE(SUM(s.sale_total) FILTER (WHERE s.is_sale), 0) AS revenue,
      COALESCE(SUM(s.purchase_total) FILTER (WHERE s.is_purchase), 0) AS purchases,
      COALESCE(SUM(s.discount) FILTER (WHERE s.is_sale), 0) AS discounts,
      COALESCE(SUM(s.known_net) FILTER (WHERE s.is_sale AND s.cost_known), 0)
        - COALESCE(SUM(s.cogs) FILTER (WHERE s.is_sale AND s.cost_known), 0) AS profit,
      COUNT(s.y) FILTER (WHERE s.is_sale) AS txn
    FROM (
      SELECT y, m
      FROM generate_series(v_first_year, v_current_year) AS y,
           generate_series(0, 11) AS m
    ) g
    LEFT JOIN scope s ON s.y = g.y AND s.m = g.m
    GROUP BY g.y, g.m
  ),
  per_year AS (
    SELECT c.y, SUM(c.revenue) AS revenue, SUM(c.purchases) AS purchases,
           SUM(c.discounts) AS discounts, SUM(c.profit) AS profit, SUM(c.txn) AS txn
    FROM cells c GROUP BY c.y
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'year', p.y,
        'totalRevenue', ROUND(p.revenue, 2),
        'totalRevenueNet', ROUND(p.revenue / v_vat, 2),
        'totalPurchases', ROUND(p.purchases, 2),
        'grossProfit', ROUND(p.profit, 2),
        'netProfit', ROUND(p.profit, 2),
        'totalDiscounts', ROUND(p.discounts, 2),
        'transactionCount', p.txn
      ) ORDER BY p.y) FROM per_year p
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_object_agg(t.y::text, t.months) FROM (
        SELECT c.y, jsonb_agg(jsonb_build_object(
          'monthIndex', c.m,
          'revenue', ROUND(c.revenue, 2),
          'revenueNet', ROUND(c.revenue / v_vat, 2),
          'purchases', ROUND(c.purchases, 2),
          'grossProfit', ROUND(c.profit, 2),
          'netProfit', ROUND(c.profit, 2),
          'discounts', ROUND(c.discounts, 2),
          'transactionCount', c.txn
        ) ORDER BY c.m) AS months
        FROM cells c GROUP BY c.y
      ) t
    ), '{}'::jsonb)
  INTO v_years, v_monthly;

  SELECT (e->>'totalRevenue')::numeric, (e->>'netProfit')::numeric, (e->>'totalDiscounts')::numeric
    INTO v_cur_rev, v_cur_prof, v_cur_disc
  FROM jsonb_array_elements(v_years) e
  WHERE (e->>'year')::int = v_current_year;

  SELECT (e->>'totalRevenue')::numeric, (e->>'netProfit')::numeric, (e->>'totalDiscounts')::numeric
    INTO v_prev_rev, v_prev_prof, v_prev_disc
  FROM jsonb_array_elements(v_years) e
  WHERE (e->>'year')::int = v_current_year - 1;

  IF v_cur_rev IS NOT NULL AND v_prev_rev IS NOT NULL AND v_prev_rev > 0 THEN
    v_comparisons := jsonb_build_object(
      'currentYear', v_current_year,
      'previousYear', v_current_year - 1,
      'revenueChange', ROUND(v_cur_rev - v_prev_rev, 2),
      'revenueChangePercent', ROUND(((v_cur_rev - v_prev_rev) / v_prev_rev) * 100, 2),
      'profitChange', ROUND(v_cur_prof - v_prev_prof, 2),
      'profitChangePercent', CASE WHEN v_prev_prof <> 0
        THEN ROUND(((v_cur_prof - v_prev_prof) / ABS(v_prev_prof)) * 100, 2) ELSE 0 END,
      'discountChange', ROUND(v_cur_disc - v_prev_disc, 2),
      'discountChangePercent', CASE WHEN v_prev_disc <> 0
        THEN ROUND(((v_cur_disc - v_prev_disc) / v_prev_disc) * 100, 2) ELSE 0 END
    );
  ELSE
    v_comparisons := 'null'::jsonb;
  END IF;

  RETURN jsonb_build_object('years', v_years, 'monthlyByYear', v_monthly, 'comparisons', v_comparisons);
END;
$function$;

COMMIT;
