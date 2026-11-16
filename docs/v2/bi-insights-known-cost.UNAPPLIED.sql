-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
-- Does not update stored rows.
--
-- Run only after docs/v2/sale-profit-reporting.UNAPPLIED.sql.
-- That file creates sale_cost_known. This file uses it so a missing cost
-- is left out of profit instead of being treated as zero.
-- On legacy_sale_request, a stored 0 remains a real zero. On older sale
-- rows, 0 stays unknown because the current client wrote 0 for a missing cost.
-- Revenue fields stay VAT-inclusive. grossProfit and netProfit both become
-- the same ex-VAT known-cost profit. There is no operating-expense layer.
-- Purchases, supplier lists and stock insights keep their existing filters.
-- Dead-stock estimated value still uses the product cost and is unchanged here.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE OR REPLACE FUNCTION public.bi_analytics_yearly(
  p_business_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz            text    := 'Asia/Jerusalem';
  v_vat           numeric := 1.18;
  v_start         timestamptz;
  v_end           timestamptz;
  v_sales_data    jsonb;
  v_top_products  jsonb;
  v_supplier_data jsonb;
  v_monthly_pur   jsonb;
  v_metrics       jsonb;
  v_avg_disc      numeric;
  v_has_sale      boolean;
  v_has_purchase  boolean;
BEGIN
  -- === Phase A2.S1 authorization guard (tenant isolation) ===
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  -- === end guard ===

  IF p_year IS NULL OR p_year < 2000 OR p_year > 2200 THEN
    RAISE EXCEPTION 'invalid year' USING ERRCODE = '22023';
  END IF;

  v_start := (make_timestamp(p_year, 1, 1, 0, 0, 0) AT TIME ZONE v_tz);
  v_end   := ((make_timestamp(p_year, 12, 31, 23, 59, 59) + interval '0.999 second') AT TIME ZONE v_tz);

  ---------------------------------------------------------------------------
  -- 1) Monthly sales / purchases series (12 zero-filled months)
  ---------------------------------------------------------------------------
  WITH grid AS (
    SELECT generate_series(0, 11) AS m
  ),
  act AS (
    SELECT
      EXTRACT(MONTH FROM (ia.timestamp AT TIME ZONE v_tz))::int - 1 AS m,
      (ia.action_type IN ('remove', 'sale') AND ia.sale_total_ils IS NOT NULL)     AS is_sale,
      (ia.action_type IN ('add', 'purchase') AND ia.purchase_total_ils IS NOT NULL) AS is_pur,
      COALESCE(ia.sale_total_ils, 0)     AS st,
      COALESCE(ia.purchase_total_ils, 0) AS pt,
      COALESCE(ia.discount_ils, 0)       AS d,
      CASE WHEN ia.action_type IN ('remove', 'sale') AND ia.sale_total_ils IS NOT NULL
            AND public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN ia.cost_snapshot_ils * ABS(COALESCE(ia.quantity_changed, 0)) ELSE 0 END AS cg,
      CASE WHEN ia.action_type IN ('remove', 'sale') AND ia.sale_total_ils IS NOT NULL
            AND public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN COALESCE(ia.sale_total_ils, 0) / v_vat ELSE 0 END AS known_net
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_start
      AND ia.timestamp <= v_end
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
  ),
  cells AS (
    SELECT
      g.m,
      COALESCE(SUM(a.st) FILTER (WHERE a.is_sale), 0) AS rev,
      COALESCE(SUM(a.pt) FILTER (WHERE a.is_pur),  0) AS pur,
      COALESCE(SUM(a.d)  FILTER (WHERE a.is_sale), 0) AS dis,
      COALESCE(SUM(a.cg) FILTER (WHERE a.is_sale), 0) AS cogs,
      COALESCE(SUM(a.known_net) FILTER (WHERE a.is_sale), 0) AS known_net
    FROM grid g
    LEFT JOIN act a ON a.m = g.m
    GROUP BY g.m
  )
  SELECT jsonb_agg(
           jsonb_build_object(
             'monthIndex',  m,
             'revenue',     ROUND(rev, 2),
             'revenueNet',  ROUND(rev / v_vat, 2),
             'purchases',   ROUND(pur, 2),
             'grossProfit', ROUND(known_net - cogs, 2),
             'netProfit',   ROUND(known_net - cogs, 2),
             'discounts',   ROUND(dis, 2)
           ) ORDER BY m
         )
  INTO v_sales_data
  FROM cells;

  ---------------------------------------------------------------------------
  -- 2) Average discount percent (sales rows carrying a positive percent)
  ---------------------------------------------------------------------------
  SELECT COALESCE(AVG(ia.discount_percent), 0)
  INTO v_avg_disc
  FROM public.inventory_actions ia
  WHERE ia.business_id = p_business_id
    AND ia.timestamp >= v_start
    AND ia.timestamp <= v_end
    AND ia.is_reversal = false
    AND ia.reversed_at IS NULL
    AND ia.action_type IN ('remove', 'sale')
    AND ia.discount_percent IS NOT NULL
    AND ia.discount_percent > 0;

  ---------------------------------------------------------------------------
  -- 3) Yearly metrics = sum of the rounded monthly cells (matches prior hook)
  ---------------------------------------------------------------------------
  SELECT jsonb_build_object(
           'totalRevenue',       ROUND(SUM((e ->> 'revenue')::numeric), 2),
           'totalRevenueNet',    ROUND(SUM((e ->> 'revenueNet')::numeric), 2),
           'totalPurchases',     ROUND(SUM((e ->> 'purchases')::numeric), 2),
           'grossProfit',        ROUND(SUM((e ->> 'grossProfit')::numeric), 2),
           'netProfit',          ROUND(SUM((e ->> 'netProfit')::numeric), 2),
           'totalDiscounts',     ROUND(SUM((e ->> 'discounts')::numeric), 2),
           'avgDiscountPercent', ROUND(v_avg_disc, 2)
         )
  INTO v_metrics
  FROM jsonb_array_elements(v_sales_data) AS e;

  ---------------------------------------------------------------------------
  -- 4) Top 5 products by gross sales revenue
  ---------------------------------------------------------------------------
  WITH s AS (
    SELECT
      ia.product_id,
      pr.name AS pname,
      ABS(COALESCE(ia.quantity_changed, 0)) AS q,
      COALESCE(ia.sale_total_ils, 0)        AS st,
      CASE WHEN public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN ia.cost_snapshot_ils * ABS(COALESCE(ia.quantity_changed, 0)) ELSE 0 END AS cg,
      CASE WHEN public.sale_cost_known(ia.cost_snapshot_ils, ia.reference_type)
           THEN COALESCE(ia.sale_total_ils, 0) / v_vat ELSE 0 END AS known_net
    FROM public.inventory_actions ia
    JOIN public.products pr ON pr.id = ia.product_id
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_start
      AND ia.timestamp <= v_end
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND ia.action_type IN ('remove', 'sale')
      AND ia.sale_total_ils IS NOT NULL
  ),
  g AS (
    SELECT
      s.product_id,
      MIN(s.pname) AS pname,
      SUM(s.q)     AS qty,
      SUM(s.st)    AS rev,
      SUM(s.cg)    AS cogs,
      SUM(s.known_net) AS known_net
    FROM s
    GROUP BY s.product_id
    ORDER BY SUM(s.st) DESC
    LIMIT 5
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'productId',   g.product_id,
               'productName', g.pname,
               'quantity',    g.qty,
               'revenue',     ROUND(g.rev, 2),
               'revenueNet',  ROUND(g.rev / v_vat, 2),
               'profit',      ROUND(g.known_net - g.cogs, 2),
               'profitNet',   ROUND(g.known_net - g.cogs, 2)
             ) ORDER BY g.rev DESC
           ),
           '[]'::jsonb
         )
  INTO v_top_products
  FROM g;

  ---------------------------------------------------------------------------
  -- 5) Supplier purchase split
  --    Supplier resolution mirrors the previous hook: the product's supplier
  --    first, falling back to the supplier recorded on the action itself.
  ---------------------------------------------------------------------------
  WITH pu AS (
    SELECT
      COALESCE(pr.supplier_id, ia.supplier_id) AS sid,
      COALESCE(ia.quantity_changed, 0)         AS vol,
      COALESCE(ia.purchase_total_ils, 0)       AS tot
    FROM public.inventory_actions ia
    JOIN public.products pr ON pr.id = ia.product_id
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_start
      AND ia.timestamp <= v_end
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND ia.action_type IN ('add', 'purchase')
      AND ia.purchase_total_ils IS NOT NULL
  ),
  g AS (
    SELECT pu.sid, SUM(pu.vol) AS vol, SUM(pu.tot) AS tot
    FROM pu
    WHERE pu.sid IS NOT NULL
    GROUP BY pu.sid
  ),
  t AS (
    SELECT COALESCE(SUM(g.vol), 0) AS total_vol FROM g
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'supplierId',     g.sid,
               'supplierName',   sup.name,
               'purchaseVolume', g.vol,
               'purchaseTotal',  ROUND(g.tot, 2),
               'percentage',     CASE WHEN t.total_vol > 0
                                      THEN ROUND(100.0 * g.vol / t.total_vol)
                                      ELSE 0 END
             ) ORDER BY g.tot DESC
           ),
           '[]'::jsonb
         )
  INTO v_supplier_data
  FROM g
  CROSS JOIN t
  LEFT JOIN public.suppliers sup ON sup.id = g.sid;

  ---------------------------------------------------------------------------
  -- 6) Leading purchased product per month (12 zero-filled months)
  ---------------------------------------------------------------------------
  WITH grid AS (
    SELECT generate_series(0, 11) AS m
  ),
  pu AS (
    SELECT
      EXTRACT(MONTH FROM (ia.timestamp AT TIME ZONE v_tz))::int - 1 AS m,
      ia.product_id,
      pr.name AS pname,
      COALESCE(ia.quantity_changed, 0)   AS q,
      COALESCE(ia.purchase_total_ils, 0) AS t
    FROM public.inventory_actions ia
    JOIN public.products pr ON pr.id = ia.product_id
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= v_start
      AND ia.timestamp <= v_end
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND ia.action_type IN ('add', 'purchase')
      AND ia.purchase_total_ils IS NOT NULL
      AND COALESCE(ia.quantity_changed, 0) <> 0
  ),
  g AS (
    SELECT pu.m, pu.product_id, MIN(pu.pname) AS pname, SUM(pu.q) AS qty, SUM(pu.t) AS tot
    FROM pu
    GROUP BY pu.m, pu.product_id
  ),
  r AS (
    SELECT g.*, ROW_NUMBER() OVER (PARTITION BY g.m ORDER BY g.tot DESC) AS rn
    FROM g
  )
  SELECT jsonb_agg(
           jsonb_build_object(
             'monthIndex',  grid.m,
             'productName', r.pname,
             'quantity',    COALESCE(r.qty, 0),
             'totalCost',   COALESCE(ROUND(r.tot, 2), 0)
           ) ORDER BY grid.m
         )
  INTO v_monthly_pur
  FROM grid
  LEFT JOIN r ON r.m = grid.m AND r.rn = 1;

  ---------------------------------------------------------------------------
  -- 7) Data-presence flags
  ---------------------------------------------------------------------------
  SELECT
    EXISTS (
      SELECT 1 FROM public.inventory_actions ia
      WHERE ia.business_id = p_business_id
        AND ia.timestamp >= v_start AND ia.timestamp <= v_end
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
        AND ia.action_type IN ('remove', 'sale')
        AND ia.sale_total_ils IS NOT NULL
    ),
    EXISTS (
      SELECT 1 FROM public.inventory_actions ia
      WHERE ia.business_id = p_business_id
        AND ia.timestamp >= v_start AND ia.timestamp <= v_end
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
        AND ia.action_type IN ('add', 'purchase')
        AND ia.purchase_total_ils IS NOT NULL
    )
  INTO v_has_sale, v_has_purchase;

  RETURN jsonb_build_object(
    'year',             p_year,
    'salesData',        COALESCE(v_sales_data, '[]'::jsonb),
    'topProducts',      COALESCE(v_top_products, '[]'::jsonb),
    'supplierData',     COALESCE(v_supplier_data, '[]'::jsonb),
    'monthlyPurchases', COALESCE(v_monthly_pur, '[]'::jsonb),
    'metrics',          COALESCE(v_metrics, '{}'::jsonb),
    'hasSaleData',      COALESCE(v_has_sale, false),
    'hasPurchaseData',  COALESCE(v_has_purchase, false)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bi_analytics_yearly(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bi_analytics_yearly(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.bi_analytics_yearly(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_analytics_yearly(uuid, integer) TO service_role;

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
           l.reference_type,
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
           sum(CASE WHEN public.sale_cost_known(s.cost_snapshot_ils, s.reference_type)
                    THEN s.sale_total_ils / v_vat ELSE 0 END)                              AS known_net,
           sum(CASE WHEN public.sale_cost_known(s.cost_snapshot_ils, s.reference_type)
                    THEN s.cost_snapshot_ils * abs(coalesce(s.quantity_changed, 0)) ELSE 0 END) AS known_cogs,
           bool_or(public.sale_cost_known(s.cost_snapshot_ils, s.reference_type))          AS any_known
    FROM ytd_sales s
    GROUP BY s.product_id
  ),
  low_margin AS (
    SELECT jsonb_build_object(
             'productId',     pr.product_id,
             'productName',   p.name,
             'unitsSold',     pr.units_sold,
             'revenue',       round(pr.revenue, 2),
             'grossProfit',   round(pr.known_net - pr.known_cogs, 2),
             'marginPercent', round(CASE WHEN pr.known_net > 0
                                         THEN (pr.known_net - pr.known_cogs) / pr.known_net * 100
                                         ELSE 0 END, 4)
           ) AS j,
           CASE WHEN pr.known_net > 0 THEN (pr.known_net - pr.known_cogs) / pr.known_net * 100 ELSE 0 END AS mp
    FROM prof pr
    JOIN public.products p ON p.id = pr.product_id
    WHERE pr.any_known
      AND ((CASE WHEN pr.known_net > 0 THEN (pr.known_net - pr.known_cogs) / pr.known_net * 100 ELSE 0 END)
            < p_low_margin_percent
       OR (pr.known_net - pr.known_cogs) < 0)
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
           sum(CASE WHEN public.sale_cost_known(s.cost_snapshot_ils, s.reference_type)
                    THEN s.sale_total_ils / v_vat ELSE 0 END)                          AS known_net,
           sum(CASE WHEN public.sale_cost_known(s.cost_snapshot_ils, s.reference_type)
                    THEN s.cost_snapshot_ils * abs(coalesce(s.quantity_changed, 0)) ELSE 0 END) AS known_cogs,
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
               'grossProfit',        round(coalesce(b.known_net, 0) - coalesce(b.known_cogs, 0), 2),
               'netProfit',          round(coalesce(b.known_net, 0) - coalesce(b.known_cogs, 0), 2),
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

COMMIT;
