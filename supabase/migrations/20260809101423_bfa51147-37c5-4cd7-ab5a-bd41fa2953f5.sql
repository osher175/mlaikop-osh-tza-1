-- =====================================================================
-- Phase A2.S4 — Insights correctness + server-side aggregation
-- =====================================================================
-- Canonical business rules (shared with reports_aggregate / yoy_financials
-- / bi_analytics_yearly):
--   live      = is_reversal = false AND reversed_at IS NULL
--   sales     = action_type IN ('remove','sale')  AND sale_total_ils IS NOT NULL
--   purchases = action_type IN ('add','purchase') AND (purchase_unit_ils
--               IS NOT NULL OR purchase_total_ils IS NOT NULL)
--   unit cost = COALESCE(purchase_unit_ils, purchase_total_ils/|qty|)
--   VAT 18%, month boundaries in Asia/Jerusalem
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fix + secure the last-sale helper (used only by the Insights hook).
--    Previously matched action_type = 'remove' only, which made virtually
--    every in-stock product look "never sold" -> false dead stock.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_last_sale_at_by_product(p_business_id uuid)
RETURNS TABLE(product_id uuid, last_sale_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for business %', p_business_id
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ia.product_id, max(ia."timestamp") AS last_sale_at
  FROM public.inventory_actions ia
  WHERE ia.business_id = p_business_id
    AND ia.action_type IN ('remove', 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.is_reversal = false
    AND ia.reversed_at IS NULL
  GROUP BY ia.product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_last_sale_at_by_product(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_last_sale_at_by_product(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_last_sale_at_by_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_sale_at_by_product(uuid) TO service_role;


-- ---------------------------------------------------------------------
-- 2. insights_aggregate: all six insights computed server-side.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insights_aggregate(
  p_business_id              uuid,
  p_lookback_sales_days      integer DEFAULT 30,
  p_lookback_purchases_days  integer DEFAULT 90,
  p_stockout_days_cover      numeric DEFAULT 7,
  p_dead_stock_days          integer DEFAULT 60,
  p_high_discount_percent    numeric DEFAULT 25,
  p_cost_increase_percent    numeric DEFAULT 10,
  p_low_margin_percent       numeric DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tz          text := 'Asia/Jerusalem';
  v_vat         numeric := 1.18;
  v_now         timestamptz := now();
  v_year        integer;
  v_year_start  timestamptz;
  v_sales_from  timestamptz;
  v_pur_from    timestamptz;
  v_pur30_from  timestamptz;
  v_result      jsonb;
BEGIN
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for business %', p_business_id
      USING ERRCODE = '42501';
  END IF;

  v_year       := extract(year from (v_now AT TIME ZONE v_tz))::int;
  v_year_start := make_timestamp(v_year, 1, 1, 0, 0, 0) AT TIME ZONE v_tz;
  v_sales_from := v_now - make_interval(days => p_lookback_sales_days);
  v_pur_from   := v_now - make_interval(days => p_lookback_purchases_days);
  v_pur30_from := v_now - make_interval(days => p_lookback_sales_days);

  WITH live AS (
    SELECT ia.*
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
  ),
  -- ---- year-to-date sales (financial insights) ----
  ytd_sales AS (
    SELECT l.product_id,
           l.sale_total_ils,
           l.discount_ils,
           l.discount_percent,
           l.cost_snapshot_ils,
           l.quantity_changed,
           extract(month from (l."timestamp" AT TIME ZONE v_tz))::int - 1 AS m
    FROM live l
    WHERE l.action_type IN ('remove', 'sale')
      AND l.sale_total_ils IS NOT NULL
      AND l."timestamp" >= v_year_start
  ),
  -- ---- INSIGHT A: low margin ----
  prof AS (
    SELECT s.product_id,
           sum(abs(coalesce(s.quantity_changed, 0)))                                    AS units_sold,
           sum(s.sale_total_ils)                                                        AS revenue,
           sum(s.sale_total_ils)
             - sum(coalesce(s.cost_snapshot_ils, 0) * abs(coalesce(s.quantity_changed, 0))) AS gross_profit
    FROM ytd_sales s
    GROUP BY s.product_id
  ),
  low_margin AS (
    SELECT jsonb_build_object(
             'productId',     pr.product_id,
             'productName',   p.name,
             'unitsSold',     pr.units_sold,
             'revenue',       round(pr.revenue, 2),
             'grossProfit',   round(pr.gross_profit, 2),
             'marginPercent', round(CASE WHEN pr.revenue > 0
                                         THEN pr.gross_profit / pr.revenue * 100
                                         ELSE 0 END, 4)
           ) AS j,
           CASE WHEN pr.revenue > 0 THEN pr.gross_profit / pr.revenue * 100 ELSE 0 END AS mp
    FROM prof pr
    JOIN public.products p ON p.id = pr.product_id
    WHERE (CASE WHEN pr.revenue > 0 THEN pr.gross_profit / pr.revenue * 100 ELSE 0 END)
            < p_low_margin_percent
       OR pr.gross_profit < 0
    ORDER BY mp ASC
    LIMIT 10
  ),
  -- ---- INSIGHT B: high discounts ----
  disc AS (
    SELECT s.product_id,
           sum(coalesce(s.discount_ils, 0)) AS total_discount,
           avg(s.discount_percent)          AS avg_discount,
           count(*)                         AS sales_count
    FROM ytd_sales s
    WHERE s.discount_percent IS NOT NULL
    GROUP BY s.product_id
  ),
  high_discount AS (
    SELECT jsonb_build_object(
             'productId',          d.product_id,
             'productName',        p.name,
             'avgDiscountPercent', round(d.avg_discount, 4),
             'totalDiscountIls',   round(d.total_discount, 2),
             'salesCount',         d.sales_count
           ) AS j
    FROM disc d
    JOIN public.products p ON p.id = d.product_id
    WHERE d.avg_discount >= p_high_discount_percent
    ORDER BY d.avg_discount DESC
    LIMIT 10
  ),
  -- ---- INSIGHT C: dead stock (full history) ----
  last_sale AS (
    SELECT l.product_id, max(l."timestamp") AS t
    FROM live l
    WHERE l.action_type IN ('remove', 'sale')
      AND l.sale_total_ils IS NOT NULL
    GROUP BY l.product_id
  ),
  dead AS (
    SELECT p.id,
           p.name,
           p.quantity,
           CASE WHEN ls.t IS NULL THEN NULL
                ELSE floor(extract(epoch from (v_now - ls.t)) / 86400)::int END AS days_since
    FROM public.products p
    LEFT JOIN last_sale ls ON ls.product_id = p.id
    WHERE p.business_id = p_business_id
      AND p.quantity > 0
  ),
  dead_stock AS (
    SELECT jsonb_build_object(
             'productId',         d.id,
             'productName',       d.name,
             'quantity',          d.quantity,
             'daysSinceLastSale', d.days_since,
             'estimatedValue',    CASE WHEN coalesce(pp.cost, 0) > 0
                                       THEN round(d.quantity * pp.cost, 2)
                                       ELSE 0 END
           ) AS j
    FROM dead d
    JOIN public.products pp ON pp.id = d.id
    WHERE d.days_since IS NULL OR d.days_since >= p_dead_stock_days
    ORDER BY (d.days_since IS NOT NULL), d.days_since DESC
    LIMIT 20
  ),
  -- ---- INSIGHT D: stockout risk ----
  sales_lookback AS (
    SELECT l.product_id, sum(abs(coalesce(l.quantity_changed, 0))) AS units
    FROM live l
    WHERE l.action_type IN ('remove', 'sale')
      AND l.sale_total_ils IS NOT NULL
      AND l."timestamp" >= v_sales_from
    GROUP BY l.product_id
  ),
  stockout AS (
    SELECT jsonb_build_object(
             'productId',       p.id,
             'productName',     p.name,
             'currentQuantity', p.quantity,
             'avgDailySales',   round(sl.units::numeric / p_lookback_sales_days, 2),
             'daysCover',       round(p.quantity / (sl.units::numeric / p_lookback_sales_days), 1)
           ) AS j,
           p.quantity / (sl.units::numeric / p_lookback_sales_days) AS dc
    FROM public.products p
    JOIN sales_lookback sl ON sl.product_id = p.id
    WHERE p.business_id = p_business_id
      AND sl.units > 0
      AND p.quantity / (sl.units::numeric / p_lookback_sales_days) < p_stockout_days_cover
    ORDER BY dc ASC
    LIMIT 20
  ),
  -- ---- INSIGHT E: cost spike ----
  pur AS (
    SELECT l.product_id,
           l."timestamp" AS ts,
           coalesce(l.purchase_unit_ils,
                    l.purchase_total_ils / nullif(abs(coalesce(l.quantity_changed, 0)), 0)) AS unit_cost
    FROM live l
    WHERE l.action_type IN ('add', 'purchase')
      AND (l.purchase_unit_ils IS NOT NULL OR l.purchase_total_ils IS NOT NULL)
      AND l."timestamp" >= v_pur_from
  ),
  pur_valid AS (
    SELECT * FROM pur WHERE unit_cost IS NOT NULL AND unit_cost > 0
  ),
  cost90 AS (SELECT product_id, avg(unit_cost) c FROM pur_valid GROUP BY product_id),
  cost30 AS (SELECT product_id, avg(unit_cost) c FROM pur_valid
             WHERE ts >= v_pur30_from GROUP BY product_id),
  cost_spike AS (
    SELECT jsonb_build_object(
             'productId',     c90.product_id,
             'productName',   p.name,
             'avgCost90Days', round(c90.c, 2),
             'avgCost30Days', round(c30.c, 2),
             'changePercent', round((c30.c - c90.c) / c90.c * 100, 2),
             'supplierName',  s.name
           ) AS j,
           (c30.c - c90.c) / c90.c * 100 AS chg
    FROM cost90 c90
    JOIN cost30 c30 ON c30.product_id = c90.product_id
    JOIN public.products p ON p.id = c90.product_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id
    WHERE c90.c > 0
      AND (c30.c - c90.c) / c90.c * 100 >= p_cost_increase_percent
    ORDER BY chg DESC
    LIMIT 10
  ),
  -- ---- INSIGHT F: business health (12 zero-filled months, YTD) ----
  bh_raw AS (
    SELECT s.m,
           sum(s.sale_total_ils)                                                     AS revenue,
           sum(coalesce(s.discount_ils, 0))                                          AS discounts,
           sum(coalesce(s.cost_snapshot_ils, 0) * abs(coalesce(s.quantity_changed, 0))) AS cogs,
           sum(coalesce(s.discount_percent, 0))                                      AS disc_pct_sum,
           count(*)                                                                  AS n
    FROM ytd_sales s
    GROUP BY s.m
  ),
  bh AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'monthIndex',         g.m,
               'totalRevenue',       round(coalesce(b.revenue, 0), 2),
               'totalRevenueNet',    round(coalesce(b.revenue, 0) / v_vat, 2),
               'totalDiscounts',     round(coalesce(b.discounts, 0), 2),
               'grossProfit',        round(coalesce(b.revenue, 0) - coalesce(b.cogs, 0), 2),
               'netProfit',          round(coalesce(b.revenue, 0) / v_vat - coalesce(b.cogs, 0), 2),
               'avgDiscountPercent', round(CASE WHEN coalesce(b.n, 0) > 0
                                                THEN b.disc_pct_sum / b.n ELSE 0 END, 2)
             ) ORDER BY g.m
           ) AS j
    FROM generate_series(0, 11) g(m)
    LEFT JOIN bh_raw b ON b.m = g.m
  )
  SELECT jsonb_build_object(
           'year',           v_year,
           'lowMargin',      coalesce((SELECT jsonb_agg(j) FROM low_margin),    '[]'::jsonb),
           'highDiscount',   coalesce((SELECT jsonb_agg(j) FROM high_discount), '[]'::jsonb),
           'deadStock',      coalesce((SELECT jsonb_agg(j) FROM dead_stock),    '[]'::jsonb),
           'stockoutRisk',   coalesce((SELECT jsonb_agg(j) FROM stockout),      '[]'::jsonb),
           'costSpike',      coalesce((SELECT jsonb_agg(j) FROM cost_spike),    '[]'::jsonb),
           'businessHealth', coalesce((SELECT j FROM bh),                       '[]'::jsonb)
         )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.insights_aggregate(uuid, integer, integer, numeric, integer, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insights_aggregate(uuid, integer, integer, numeric, integer, numeric, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.insights_aggregate(uuid, integer, integer, numeric, integer, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insights_aggregate(uuid, integer, integer, numeric, integer, numeric, numeric, numeric) TO service_role;