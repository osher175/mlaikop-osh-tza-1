-- Recreate dropped functions with proper search_path

-- 1. get_user_profile_for_admin
CREATE FUNCTION public.get_user_profile_for_admin(target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  role user_role,
  is_active boolean,
  created_at timestamptz,
  business_name text,
  subscription_plan text,
  subscription_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    e.email,
    p.first_name,
    p.last_name,
    ur.role,
    p.is_active,
    p.created_at,
    b.name as business_name,
    sp.name as subscription_plan,
    us.status as subscription_status
  FROM public.profiles p
  LEFT JOIN public.emails e ON p.id = e.user_id
  LEFT JOIN public.user_roles ur ON p.id = ur.user_id
  LEFT JOIN public.businesses b ON p.business_id = b.id
  LEFT JOIN public.user_subscriptions us ON p.id = us.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE p.id = target_user_id;
END;
$$;

-- 2. search_products
CREATE FUNCTION public.search_products(
  search_term text DEFAULT NULL,
  business_uuid uuid DEFAULT NULL,
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  barcode text,
  quantity integer,
  price numeric,
  cost numeric,
  location text,
  expiration_date date,
  category_name text,
  supplier_name text,
  search_rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
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
$$;

-- 3. get_expiring_products
CREATE FUNCTION public.get_expiring_products(
  days_ahead integer DEFAULT 30,
  target_business_id uuid DEFAULT NULL
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  quantity integer,
  expiration_date date,
  days_until_expiry integer,
  supplier_name text,
  business_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
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
$$;

-- 4. get_product_autocomplete
CREATE FUNCTION public.get_product_autocomplete(
  search_term text,
  business_uuid uuid DEFAULT NULL,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  suggestion text,
  product_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
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
$$;