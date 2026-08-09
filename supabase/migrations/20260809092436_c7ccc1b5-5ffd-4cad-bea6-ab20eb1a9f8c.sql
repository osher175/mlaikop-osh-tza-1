-- Phase A2.S2 (safety rewrite): identical rules and output, but no temp-table DDL,
-- so the function is genuinely read-only and safe under STABLE / read-only transactions.

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
  -- === Phase A2.S1 authorization guard (tenant isolation) ===
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  -- === end guard ===

  p_years := GREATEST(COALESCE(p_years, 3), 1);

  v_current_year := extract(year from (now() AT TIME ZONE v_tz))::int;
  v_first_year   := GREATEST(v_current_year - (p_years - 1), v_min_year);

  v_range_start := (make_timestamp(v_first_year, 1, 1, 0, 0, 0) AT TIME ZONE v_tz);
  v_range_end   := ((make_timestamp(v_current_year, 12, 31, 23, 59, 59) + interval '0.999 second') AT TIME ZONE v_tz);

  WITH scope AS (
    SELECT
      extract(year  from (ia.timestamp AT TIME ZONE v_tz))::int      AS y,
      extract(month from (ia.timestamp AT TIME ZONE v_tz))::int - 1  AS m,
      (ia.action_type IN ('remove','sale')   AND ia.sale_total_ils IS NOT NULL)     AS is_sale,
      (ia.action_type IN ('add','purchase')  AND ia.purchase_total_ils IS NOT NULL) AS is_purchase,
      COALESCE(ia.sale_total_ils, 0)     AS sale_total,
      COALESCE(ia.purchase_total_ils, 0) AS purchase_total,
      COALESCE(ia.discount_ils, 0)       AS discount,
      COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed) AS cogs
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_range_start
      AND ia.timestamp <= v_range_end
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND (
        (ia.action_type IN ('remove','sale')  AND ia.sale_total_ils IS NOT NULL)
        OR (ia.action_type IN ('add','purchase') AND ia.purchase_total_ils IS NOT NULL)
      )
  ),
  cells AS (
    SELECT
      g.y, g.m,
      COALESCE(SUM(s.sale_total)     FILTER (WHERE s.is_sale), 0)     AS revenue,
      COALESCE(SUM(s.purchase_total) FILTER (WHERE s.is_purchase), 0) AS purchases,
      COALESCE(SUM(s.discount)       FILTER (WHERE s.is_sale), 0)     AS discounts,
      COALESCE(SUM(s.cogs)           FILTER (WHERE s.is_sale), 0)     AS cogs,
      COUNT(s.y)                     FILTER (WHERE s.is_sale)         AS txn
    FROM (
      SELECT y, m
      FROM generate_series(v_first_year, v_current_year) AS y,
           generate_series(0, 11) AS m
    ) g
    LEFT JOIN scope s ON s.y = g.y AND s.m = g.m
    GROUP BY g.y, g.m
  ),
  per_year AS (
    SELECT
      c.y,
      SUM(c.revenue)   AS revenue,
      SUM(c.purchases) AS purchases,
      SUM(c.discounts) AS discounts,
      SUM(c.cogs)      AS cogs,
      SUM(c.txn)       AS txn
    FROM cells c
    GROUP BY c.y
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'year',             p.y,
                 'totalRevenue',     ROUND(p.revenue, 2),
                 'totalRevenueNet',  ROUND(p.revenue / v_vat, 2),
                 'totalPurchases',   ROUND(p.purchases, 2),
                 'grossProfit',      ROUND(p.revenue - p.cogs, 2),
                 'netProfit',        ROUND((p.revenue / v_vat) - p.cogs, 2),
                 'totalDiscounts',   ROUND(p.discounts, 2),
                 'transactionCount', p.txn
               ) ORDER BY p.y
             )
      FROM per_year p
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_object_agg(t.y::text, t.months)
      FROM (
        SELECT c.y,
               jsonb_agg(
                 jsonb_build_object(
                   'monthIndex',       c.m,
                   'revenue',          ROUND(c.revenue, 2),
                   'revenueNet',       ROUND(c.revenue / v_vat, 2),
                   'purchases',        ROUND(c.purchases, 2),
                   'grossProfit',      ROUND(c.revenue - c.cogs, 2),
                   'netProfit',        ROUND((c.revenue / v_vat) - c.cogs, 2),
                   'discounts',        ROUND(c.discounts, 2),
                   'transactionCount', c.txn
                 ) ORDER BY c.m
               ) AS months
        FROM cells c
        GROUP BY c.y
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
      'currentYear',           v_current_year,
      'previousYear',          v_current_year - 1,
      'revenueChange',         ROUND(v_cur_rev - v_prev_rev, 2),
      'revenueChangePercent',  ROUND(((v_cur_rev - v_prev_rev) / v_prev_rev) * 100, 2),
      'profitChange',          ROUND(v_cur_prof - v_prev_prof, 2),
      'profitChangePercent',   CASE WHEN v_prev_prof <> 0
                                    THEN ROUND(((v_cur_prof - v_prev_prof) / ABS(v_prev_prof)) * 100, 2)
                                    ELSE 0 END,
      'discountChange',        ROUND(v_cur_disc - v_prev_disc, 2),
      'discountChangePercent', CASE WHEN v_prev_disc <> 0
                                    THEN ROUND(((v_cur_disc - v_prev_disc) / v_prev_disc) * 100, 2)
                                    ELSE 0 END
    );
  ELSE
    v_comparisons := 'null'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'years',         v_years,
    'monthlyByYear', v_monthly,
    'comparisons',   v_comparisons
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.yoy_financials(uuid, integer) TO authenticated, service_role;