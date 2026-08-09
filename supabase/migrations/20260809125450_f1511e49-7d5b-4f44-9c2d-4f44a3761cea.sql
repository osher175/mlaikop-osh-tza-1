-- Bounded, tenant-scoped inventory listing + counters + notification candidates

CREATE OR REPLACE FUNCTION public.inventory_products_page(
  p_business_id uuid,
  p_search text DEFAULT NULL,
  p_stock_filter text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_items jsonb;
  v_term text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id is required';
  END IF;

  IF NOT (
    public.is_business_member(p_business_id, auth.uid())
    OR public.has_role_or_higher('admin'::user_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  v_term := NULLIF(btrim(COALESCE(p_search, '')), '');

  WITH base AS (
    SELECT p.*,
           COALESCE(pt.low_stock_threshold, 5) AS eff_threshold
    FROM public.products p
    LEFT JOIN public.product_thresholds pt
      ON pt.product_id = p.id AND pt.business_id = p.business_id
    WHERE p.business_id = p_business_id
  ), filtered AS (
    SELECT * FROM base b
    WHERE (
      v_term IS NULL
      OR b.name ILIKE '%' || v_term || '%'
      OR b.barcode ILIKE '%' || v_term || '%'
      OR b.location ILIKE '%' || v_term || '%'
    )
    AND (
      COALESCE(p_stock_filter, 'all') = 'all'
      OR (p_stock_filter = 'inStock' AND b.quantity > b.eff_threshold)
      OR (p_stock_filter = 'lowStock' AND b.quantity > 0 AND b.quantity <= b.eff_threshold)
      OR (p_stock_filter = 'outOfStock' AND b.quantity = 0)
    )
  )
  SELECT COUNT(*) INTO v_total FROM filtered;

  WITH base AS (
    SELECT p.*,
           COALESCE(pt.low_stock_threshold, 5) AS eff_threshold
    FROM public.products p
    LEFT JOIN public.product_thresholds pt
      ON pt.product_id = p.id AND pt.business_id = p.business_id
    WHERE p.business_id = p_business_id
  ), filtered AS (
    SELECT * FROM base b
    WHERE (
      v_term IS NULL
      OR b.name ILIKE '%' || v_term || '%'
      OR b.barcode ILIKE '%' || v_term || '%'
      OR b.location ILIKE '%' || v_term || '%'
    )
    AND (
      COALESCE(p_stock_filter, 'all') = 'all'
      OR (p_stock_filter = 'inStock' AND b.quantity > b.eff_threshold)
      OR (p_stock_filter = 'lowStock' AND b.quantity > 0 AND b.quantity <= b.eff_threshold)
      OR (p_stock_filter = 'outOfStock' AND b.quantity = 0)
    )
  ), page AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_json ORDER BY ord), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT ROW_NUMBER() OVER () AS ord,
      to_jsonb(pg.*) - 'eff_threshold'
      || jsonb_build_object(
           'product_categories',
           CASE WHEN pc.id IS NULL THEN NULL ELSE jsonb_build_object('name', pc.name) END,
           'suppliers',
           CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name) END,
           'product_thresholds',
           jsonb_build_object('low_stock_threshold', pg.eff_threshold)
         ) AS row_json
    FROM page pg
    LEFT JOIN public.product_categories pc ON pc.id = pg.product_category_id
    LEFT JOIN public.suppliers s ON s.id = pg.supplier_id
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_products_page(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_products_page(uuid, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_stock_counts(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id is required';
  END IF;

  IF NOT (
    public.is_business_member(p_business_id, auth.uid())
    OR public.has_role_or_higher('admin'::user_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'inStock', COUNT(*) FILTER (WHERE quantity > 5),
    'lowStock', COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= 5),
    'outOfStock', COUNT(*) FILTER (WHERE quantity = 0),
    'totalUnits', COALESCE(SUM(GREATEST(quantity, 0)), 0)
  )
  INTO v
  FROM public.products
  WHERE business_id = p_business_id;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_stock_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_stock_counts(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.products_needing_notifications(
  p_business_id uuid,
  p_low_stock_enabled boolean,
  p_default_low_threshold integer,
  p_expiration_enabled boolean,
  p_expiration_days integer,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  name text,
  quantity integer,
  expiration_date date,
  business_id uuid,
  low_stock_threshold integer,
  needs_low_stock boolean,
  needs_expiration boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id is required';
  END IF;

  IF NOT (
    public.is_business_member(p_business_id, auth.uid())
    OR public.has_role_or_higher('admin'::user_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.name, p.quantity, p.expiration_date, p.business_id,
           COALESCE(pt.low_stock_threshold, COALESCE(p_default_low_threshold, 5)) AS eff_threshold
    FROM public.products p
    LEFT JOIN public.product_thresholds pt
      ON pt.product_id = p.id AND pt.business_id = p.business_id
    WHERE p.business_id = p_business_id
  )
  SELECT b.id, b.name, b.quantity, b.expiration_date, b.business_id,
         b.eff_threshold,
         (COALESCE(p_low_stock_enabled, false) AND b.quantity <= b.eff_threshold) AS needs_low_stock,
         (COALESCE(p_expiration_enabled, false) AND b.expiration_date IS NOT NULL
            AND b.expiration_date <= (CURRENT_DATE + COALESCE(p_expiration_days, 0))) AS needs_expiration
  FROM base b
  WHERE (COALESCE(p_low_stock_enabled, false) AND b.quantity <= b.eff_threshold)
     OR (COALESCE(p_expiration_enabled, false) AND b.expiration_date IS NOT NULL
            AND b.expiration_date <= (CURRENT_DATE + COALESCE(p_expiration_days, 0)))
  ORDER BY b.quantity ASC, b.expiration_date ASC NULLS LAST
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.products_needing_notifications(uuid, boolean, integer, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.products_needing_notifications(uuid, boolean, integer, boolean, integer, integer) TO authenticated, service_role;