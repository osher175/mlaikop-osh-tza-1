-- Phase A2.S1 (follow-up): align the analytics guard with the app's own tenant model,
-- which also treats approved public.business_users rows as members.

CREATE OR REPLACE FUNCTION public.can_access_business_analytics(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- internal server-to-server callers (Public Read API resolves the business from the API key)
    COALESCE(auth.role() = 'service_role', false)
    OR (
      _business_id IS NOT NULL
      AND _user_id IS NOT NULL
      AND (
        COALESCE(public.has_role_or_higher('admin'::public.user_role, _user_id), false)
        OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.user_businesses ub WHERE ub.business_id = _business_id AND ub.user_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.business_id = _business_id AND bu.user_id = _user_id AND bu.status = 'approved')
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_access_business_analytics(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business_analytics(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business_analytics(uuid, uuid) TO authenticated, service_role;

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
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
  top_products_list jsonb := '[]'::jsonb;
  purchases_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- === Phase A2.S1 authorization guard (tenant isolation) ===
  IF NOT public.can_access_business_analytics(reports_aggregate.business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  -- === end guard ===

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

  revenue_net := revenue_gross / 1.18;

  SELECT COALESCE(SUM(COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed)), 0) INTO cogs_total
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  gross_profit := revenue_gross - cogs_total;
  net_profit := ROUND(revenue_net - cogs_total, 2);

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

CREATE OR REPLACE FUNCTION public.get_top_sales_by_dimension(p_business_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_dimension text DEFAULT 'product'::text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- === Phase A2.S1 authorization guard (tenant isolation) ===
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  -- === end guard ===

  IF p_dimension = 'brand' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(b.id::text,'unknown') AS key, COALESCE(b.name,'ללא מותג') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.brands b ON b.id = p.brand_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY b.id, b.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSIF p_dimension = 'category' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(pc.id::text,'unknown') AS key, COALESCE(pc.name,'ללא קטגוריה') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.product_categories pc ON pc.id = p.product_category_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY pc.id, pc.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSIF p_dimension = 'supplier' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(s.id::text,'unknown') AS key, COALESCE(s.name,'ללא ספק') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY s.id, s.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSE
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT p.id::text AS key, p.name AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY p.id, p.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  END IF;
  RETURN result;
END;
$function$;