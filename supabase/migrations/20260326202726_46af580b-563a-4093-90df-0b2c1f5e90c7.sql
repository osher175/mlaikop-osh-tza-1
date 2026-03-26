
CREATE OR REPLACE FUNCTION public.get_top_sales_by_dimension(
  p_business_id uuid,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_dimension text DEFAULT 'product',
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_dimension = 'product' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result
    FROM (
      SELECT
        p.id::text AS key,
        p.name AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold,
        COALESCE(SUM(ia.sale_total_ils), 0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from
        AND ia.timestamp < p_date_to + interval '1 second'
      GROUP BY p.id, p.name
      ORDER BY SUM(ABS(ia.quantity_changed)) DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'brand' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result
    FROM (
      SELECT
        COALESCE(b.id::text, 'unknown') AS key,
        COALESCE(b.name, 'ללא מותג') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold,
        COALESCE(SUM(ia.sale_total_ils), 0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.brands b ON b.id = p.brand_id
      WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from
        AND ia.timestamp < p_date_to + interval '1 second'
      GROUP BY b.id, b.name
      ORDER BY SUM(ABS(ia.quantity_changed)) DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'category' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result
    FROM (
      SELECT
        COALESCE(pc.id::text, 'unknown') AS key,
        COALESCE(pc.name, 'ללא קטגוריה') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold,
        COALESCE(SUM(ia.sale_total_ils), 0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.product_categories pc ON pc.id = p.product_category_id
      WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from
        AND ia.timestamp < p_date_to + interval '1 second'
      GROUP BY pc.id, pc.name
      ORDER BY SUM(ABS(ia.quantity_changed)) DESC
      LIMIT p_limit
    ) t;

  ELSIF p_dimension = 'supplier' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result
    FROM (
      SELECT
        COALESCE(s.id::text, 'unknown') AS key,
        COALESCE(s.name, 'ללא ספק') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold,
        COALESCE(SUM(ia.sale_total_ils), 0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from
        AND ia.timestamp < p_date_to + interval '1 second'
      GROUP BY s.id, s.name
      ORDER BY SUM(ABS(ia.quantity_changed)) DESC
      LIMIT p_limit
    ) t;

  ELSE
    -- Default fallback to product
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result
    FROM (
      SELECT
        p.id::text AS key,
        p.name AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold,
        COALESCE(SUM(ia.sale_total_ils), 0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from
        AND ia.timestamp < p_date_to + interval '1 second'
      GROUP BY p.id, p.name
      ORDER BY SUM(ABS(ia.quantity_changed)) DESC
      LIMIT p_limit
    ) t;
  END IF;

  RETURN result;
END;
$$;
