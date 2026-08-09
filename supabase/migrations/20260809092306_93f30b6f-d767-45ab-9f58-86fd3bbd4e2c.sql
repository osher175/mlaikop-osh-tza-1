-- Phase A2.S2: server-side Year-over-Year aggregation.
-- Replaces the client-side aggregation in useYearOverYear, which was subject to the
-- PostgREST row cap (silent truncation) and used a stale action_type rule set.
--
-- Business rules (aligned with public.reports_aggregate):
--   sales     : action_type IN ('remove','sale') AND sale_total_ils IS NOT NULL
--   purchases : action_type IN ('add','purchase') AND purchase_total_ils IS NOT NULL
--   reversals : excluded (is_reversal = false AND reversed_at IS NULL)
--   revenue_net = revenue / 1.18   (18% VAT)
--   cogs        = SUM(cost_snapshot_ils * ABS(quantity_changed)) over sales
--   gross_profit = revenue - cogs        (gross revenue incl. VAT, as before)
--   net_profit   = revenue_net - cogs
--   boundaries : calendar year/month in Asia/Jerusalem

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
  v_cur           record;
  v_prev          record;
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

  CREATE TEMP TABLE IF NOT EXISTS _yoy_scope (
    y integer,
    m integer,
    is_sale boolean,
    is_purchase boolean,
    sale_total numeric,
    purchase_total numeric,
    discount numeric,
    cogs numeric
  ) ON COMMIT DROP;

  DELETE FROM _yoy_scope;

  INSERT INTO _yoy_scope (y, m, is_sale, is_purchase, sale_total, purchase_total, discount, cogs)
  SELECT
    extract(year  from (ia.timestamp AT TIME ZONE v_tz))::int,
    extract(month from (ia.timestamp AT TIME ZONE v_tz))::int - 1,
    (ia.action_type IN ('remove','sale') AND ia.sale_total_ils IS NOT NULL),
    (ia.action_type IN ('add','purchase') AND ia.purchase_total_ils IS NOT NULL),
    COALESCE(ia.sale_total_ils, 0),
    COALESCE(ia.purchase_total_ils, 0),
    COALESCE(ia.discount_ils, 0),
    COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed)
  FROM public.inventory_actions ia
  WHERE ia.business_id = p_business_id
    AND ia.timestamp >= v_range_start
    AND ia.timestamp <= v_range_end
    AND ia.is_reversal = false
    AND ia.reversed_at IS NULL
    AND (
      (ia.action_type IN ('remove','sale')   AND ia.sale_total_ils IS NOT NULL)
      OR (ia.action_type IN ('add','purchase') AND ia.purchase_total_ils IS NOT NULL)
    );

  -- ---------- yearly totals (one row per requested year, zero-filled) ----------
  WITH yr AS (
    SELECT generate_series(v_first_year, v_current_year) AS y
  ),
  agg AS (
    SELECT
      yr.y,
      COALESCE(SUM(s.sale_total)     FILTER (WHERE s.is_sale), 0)     AS revenue,
      COALESCE(SUM(s.purchase_total) FILTER (WHERE s.is_purchase), 0) AS purchases,
      COALESCE(SUM(s.discount)       FILTER (WHERE s.is_sale), 0)     AS discounts,
      COALESCE(SUM(s.cogs)           FILTER (WHERE s.is_sale), 0)     AS cogs,
      COUNT(*)                       FILTER (WHERE s.is_sale)         AS txn
    FROM yr
    LEFT JOIN _yoy_scope s ON s.y = yr.y
    GROUP BY yr.y
  )
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'year',             a.y,
             'totalRevenue',     ROUND(a.revenue, 2),
             'totalRevenueNet',  ROUND(a.revenue / v_vat, 2),
             'totalPurchases',   ROUND(a.purchases, 2),
             'grossProfit',      ROUND(a.revenue - a.cogs, 2),
             'netProfit',        ROUND((a.revenue / v_vat) - a.cogs, 2),
             'totalDiscounts',   ROUND(a.discounts, 2),
             'transactionCount', a.txn
           ) ORDER BY a.y
         ), '[]'::jsonb)
    INTO v_years
  FROM agg a;

  -- ---------- monthly breakdown, 12 zero-filled months per year ----------
  WITH grid AS (
    SELECT y, m
    FROM generate_series(v_first_year, v_current_year) AS y,
         generate_series(0, 11) AS m
  ),
  magg AS (
    SELECT
      g.y, g.m,
      COALESCE(SUM(s.sale_total)     FILTER (WHERE s.is_sale), 0)     AS revenue,
      COALESCE(SUM(s.purchase_total) FILTER (WHERE s.is_purchase), 0) AS purchases,
      COALESCE(SUM(s.discount)       FILTER (WHERE s.is_sale), 0)     AS discounts,
      COALESCE(SUM(s.cogs)           FILTER (WHERE s.is_sale), 0)     AS cogs,
      COUNT(s.*)                     FILTER (WHERE s.is_sale)         AS txn
    FROM grid g
    LEFT JOIN _yoy_scope s ON s.y = g.y AND s.m = g.m
    GROUP BY g.y, g.m
  )
  SELECT COALESCE(jsonb_object_agg(t.y::text, t.months), '{}'::jsonb)
    INTO v_monthly
  FROM (
    SELECT
      m.y,
      jsonb_agg(
        jsonb_build_object(
          'monthIndex',       m.m,
          'revenue',          ROUND(m.revenue, 2),
          'revenueNet',       ROUND(m.revenue / v_vat, 2),
          'purchases',        ROUND(m.purchases, 2),
          'grossProfit',      ROUND(m.revenue - m.cogs, 2),
          'netProfit',        ROUND((m.revenue / v_vat) - m.cogs, 2),
          'discounts',        ROUND(m.discounts, 2),
          'transactionCount', m.txn
        ) ORDER BY m.m
      ) AS months
    FROM magg m
    GROUP BY m.y
  ) t;

  -- ---------- current vs previous year comparison ----------
  SELECT (e->>'year')::int AS year,
         (e->>'totalRevenue')::numeric AS revenue,
         (e->>'netProfit')::numeric AS net_profit,
         (e->>'totalDiscounts')::numeric AS discounts
    INTO v_cur
  FROM jsonb_array_elements(v_years) e
  WHERE (e->>'year')::int = v_current_year;

  SELECT (e->>'year')::int AS year,
         (e->>'totalRevenue')::numeric AS revenue,
         (e->>'netProfit')::numeric AS net_profit,
         (e->>'totalDiscounts')::numeric AS discounts
    INTO v_prev
  FROM jsonb_array_elements(v_years) e
  WHERE (e->>'year')::int = v_current_year - 1;

  IF v_cur IS NOT NULL AND v_prev IS NOT NULL AND v_prev.revenue > 0 THEN
    v_comparisons := jsonb_build_object(
      'currentYear',            v_current_year,
      'previousYear',           v_current_year - 1,
      'revenueChange',          ROUND(v_cur.revenue - v_prev.revenue, 2),
      'revenueChangePercent',   ROUND(((v_cur.revenue - v_prev.revenue) / v_prev.revenue) * 100, 2),
      'profitChange',           ROUND(v_cur.net_profit - v_prev.net_profit, 2),
      'profitChangePercent',    CASE WHEN v_prev.net_profit <> 0
                                     THEN ROUND(((v_cur.net_profit - v_prev.net_profit) / ABS(v_prev.net_profit)) * 100, 2)
                                     ELSE 0 END,
      'discountChange',         ROUND(v_cur.discounts - v_prev.discounts, 2),
      'discountChangePercent',  CASE WHEN v_prev.discounts <> 0
                                     THEN ROUND(((v_cur.discounts - v_prev.discounts) / v_prev.discounts) * 100, 2)
                                     ELSE 0 END
    );
  ELSE
    v_comparisons := 'null'::jsonb;
  END IF;

  DROP TABLE IF EXISTS _yoy_scope;

  RETURN jsonb_build_object(
    'years',        v_years,
    'monthlyByYear', v_monthly,
    'comparisons',  v_comparisons
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.yoy_financials(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.yoy_financials(uuid, integer) TO authenticated, service_role;