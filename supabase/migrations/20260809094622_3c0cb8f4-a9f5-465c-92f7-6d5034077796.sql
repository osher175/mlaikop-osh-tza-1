
DROP FUNCTION IF EXISTS public.bi_analytics_yearly(uuid, integer);

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
      COALESCE(ia.cost_snapshot_ils, 0) * ABS(COALESCE(ia.quantity_changed, 0)) AS cg
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
      COALESCE(SUM(a.cg) FILTER (WHERE a.is_sale), 0) AS cogs
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
             'grossProfit', ROUND(rev - cogs, 2),
             'netProfit',   ROUND(rev / v_vat - cogs, 2),
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
      COALESCE(ia.cost_snapshot_ils, 0) * ABS(COALESCE(ia.quantity_changed, 0)) AS cg
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
      SUM(s.cg)    AS cogs
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
               'profit',      ROUND(g.rev - g.cogs, 2),
               'profitNet',   ROUND(g.rev / v_vat - g.cogs, 2)
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
