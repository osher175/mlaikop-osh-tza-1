-- ============================================================
-- Phase A4.S1 — tenant-isolation guards on remaining SECURITY DEFINER helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_expiring_products(days_ahead integer DEFAULT 30, target_business_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(product_id uuid, product_name text, quantity integer, expiration_date date, days_until_expiry integer, supplier_name text, business_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Phase A4.S1 guard: service_role (cron) may scan all businesses; every other
  -- caller must name a business they belong to.
  IF NOT public.can_access_business_analytics(target_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name as product_name,
    p.quantity,
    p.expiration_date,
    (p.expiration_date - CURRENT_DATE)::integer as days_until_expiry,
    s.name as supplier_name,
    p.business_id
  FROM public.products p
  LEFT JOIN public.suppliers s ON p.supplier_id = s.id
  WHERE
    p.expiration_date IS NOT NULL
    AND p.expiration_date <= CURRENT_DATE + days_ahead
    AND (target_business_id IS NULL OR p.business_id = target_business_id)
  ORDER BY p.expiration_date ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_weekly_stock_summary(target_business_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  summary JSONB;
  total_products INTEGER;
  out_of_stock_count INTEGER;
  low_stock_count INTEGER;
  expiring_soon_count INTEGER;
BEGIN
  IF NOT public.can_access_business_analytics(target_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO total_products
  FROM public.products
  WHERE business_id = target_business_id;

  SELECT COUNT(*) INTO out_of_stock_count
  FROM public.products
  WHERE business_id = target_business_id AND quantity = 0;

  SELECT COUNT(*) INTO low_stock_count
  FROM public.products
  WHERE business_id = target_business_id AND quantity > 0 AND quantity < 5;

  SELECT COUNT(*) INTO expiring_soon_count
  FROM public.products
  WHERE business_id = target_business_id
    AND expiration_date IS NOT NULL
    AND expiration_date <= CURRENT_DATE + INTERVAL '7 days'
    AND expiration_date >= CURRENT_DATE;

  summary := jsonb_build_object(
    'business_id', target_business_id,
    'report_date', CURRENT_DATE,
    'total_products', total_products,
    'out_of_stock_count', out_of_stock_count,
    'low_stock_count', low_stock_count,
    'expiring_soon_count', expiring_soon_count,
    'generated_at', now()
  );

  RETURN summary;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_products(search_term text DEFAULT NULL::text, business_uuid uuid DEFAULT NULL::uuid, limit_count integer DEFAULT 50)
 RETURNS TABLE(id uuid, name text, barcode text, quantity integer, price numeric, cost numeric, location text, expiration_date date, category_name text, supplier_name text, search_rank real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_access_business_analytics(business_uuid, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.barcode,
    p.quantity,
    p.price,
    p.cost,
    p.location,
    p.expiration_date,
    pc.name as category_name,
    s.name as supplier_name,
    1.0::real as search_rank
  FROM public.products p
  LEFT JOIN public.product_categories pc ON p.product_category_id = pc.id
  LEFT JOIN public.suppliers s ON p.supplier_id = s.id
  WHERE
    (business_uuid IS NULL OR p.business_id = business_uuid)
    AND (
      search_term IS NULL
      OR p.name ILIKE '%' || search_term || '%'
      OR p.barcode ILIKE '%' || search_term || '%'
    )
  ORDER BY p.name
  LIMIT limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_autocomplete(search_term text, business_uuid uuid DEFAULT NULL::uuid, limit_count integer DEFAULT 10)
 RETURNS TABLE(suggestion text, product_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_access_business_analytics(business_uuid, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.name as suggestion,
    COUNT(*)::bigint as product_count
  FROM public.products p
  WHERE
    (business_uuid IS NULL OR p.business_id = business_uuid)
    AND p.name ILIKE '%' || search_term || '%'
  GROUP BY p.name
  ORDER BY product_count DESC
  LIMIT limit_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_expiring_products(integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_weekly_stock_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_products(text, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_product_autocomplete(text, uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_expiring_products(integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_weekly_stock_summary(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_products(text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_product_autocomplete(text, uuid, integer) TO authenticated, service_role;

-- ============================================================
-- Phase A4.C1 — server-side supplier purchase ranking for a period
-- Canonical purchase rules, identical to bi_analytics_yearly:
--   purchases = action_type IN ('add','purchase'), reversals excluded
-- ============================================================

CREATE OR REPLACE FUNCTION public.supplier_purchases_by_period(
  p_business_id uuid,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN
    RAISE EXCEPTION 'invalid date range' USING ERRCODE = '22023';
  END IF;

  WITH act AS (
    SELECT
      COALESCE(ia.supplier_id, p.supplier_id) AS supplier_id,
      ABS(COALESCE(ia.quantity_changed, 0))   AS qty,
      COALESCE(
        ia.purchase_total_ils,
        ABS(COALESCE(ia.quantity_changed, 0)) * COALESCE(ia.purchase_unit_ils, p.cost, 0)
      ) AS cost_total
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    WHERE ia.business_id = p_business_id
      AND ia.timestamp >= p_date_from
      AND ia.timestamp <= p_date_to
      AND ia.action_type IN ('add', 'purchase')
      AND ia.is_reversal = false
      AND ia.reversed_at IS NULL
      AND COALESCE(ia.supplier_id, p.supplier_id) IS NOT NULL
  ),
  ranked AS (
    SELECT
      a.supplier_id,
      COALESCE(s.name, 'ספק לא ידוע') AS supplier_name,
      SUM(a.qty)::bigint              AS product_count,
      ROUND(SUM(a.cost_total), 2)     AS total_cost
    FROM act a
    LEFT JOIN public.suppliers s ON s.id = a.supplier_id
    GROUP BY a.supplier_id, s.name
    ORDER BY SUM(a.qty) DESC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'supplierId',   supplier_id,
               'supplierName', supplier_name,
               'productCount', product_count,
               'totalCost',    total_cost
             ) ORDER BY product_count DESC
           ),
           '[]'::jsonb
         )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.supplier_purchases_by_period(uuid, timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_purchases_by_period(uuid, timestamptz, timestamptz, integer) TO authenticated, service_role;