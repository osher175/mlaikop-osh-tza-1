
-- First, let's verify the current products table structure and add any missing indexes for optimal search performance

-- Add full-text search indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_location_search ON public.products USING gin(to_tsvector('english', COALESCE(location, '')));

-- Add a composite index for common search queries
CREATE INDEX IF NOT EXISTS idx_products_search_composite ON public.products (name, quantity, expiration_date, location);

-- Create a function for advanced product search with autocomplete
CREATE OR REPLACE FUNCTION public.search_products(
  search_term text DEFAULT '',
  business_uuid uuid DEFAULT NULL,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  barcode text,
  quantity integer,
  location text,
  expiration_date date,
  price numeric,
  cost numeric,
  category_name text,
  supplier_name text,
  search_rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If no search term provided, return recent products
  IF search_term = '' OR search_term IS NULL THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.barcode,
      p.quantity,
      p.location,
      p.expiration_date,
      p.price,
      p.cost,
      c.name as category_name,
      s.name as supplier_name,
      1.0::real as search_rank
    FROM public.products p
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.suppliers s ON p.supplier_id = s.id
    WHERE (business_uuid IS NULL OR p.business_id = business_uuid)
    ORDER BY p.created_at DESC
    LIMIT limit_count;
  ELSE
    -- Full-text search with ranking
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.barcode,
      p.quantity,
      p.location,
      p.expiration_date,
      p.price,
      p.cost,
      c.name as category_name,
      s.name as supplier_name,
      (
        ts_rank(to_tsvector('english', p.name), plainto_tsquery('english', search_term)) * 4 +
        ts_rank(to_tsvector('english', COALESCE(p.location, '')), plainto_tsquery('english', search_term)) * 2 +
        CASE WHEN p.barcode ILIKE '%' || search_term || '%' THEN 3 ELSE 0 END +
        CASE WHEN p.name ILIKE '%' || search_term || '%' THEN 2 ELSE 0 END
      )::real as search_rank
    FROM public.products p
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.suppliers s ON p.supplier_id = s.id
    WHERE 
      (business_uuid IS NULL OR p.business_id = business_uuid)
      AND (
        to_tsvector('english', p.name) @@ plainto_tsquery('english', search_term)
        OR to_tsvector('english', COALESCE(p.location, '')) @@ plainto_tsquery('english', search_term)
        OR p.name ILIKE '%' || search_term || '%'
        OR p.barcode ILIKE '%' || search_term || '%'
        OR COALESCE(p.location, '') ILIKE '%' || search_term || '%'
      )
    ORDER BY search_rank DESC, p.name
    LIMIT limit_count;
  END IF;
END;
$$;

-- Create a function specifically for autocomplete suggestions
CREATE OR REPLACE FUNCTION public.get_product_autocomplete(
  search_term text,
  business_uuid uuid DEFAULT NULL,
  limit_count integer DEFAULT 5
)
RETURNS TABLE (
  suggestion text,
  product_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as suggestion,
    COUNT(*)::integer as product_count
  FROM public.products p
  WHERE 
    (business_uuid IS NULL OR p.business_id = business_uuid)
    AND p.name ILIKE search_term || '%'
  GROUP BY p.name
  ORDER BY product_count DESC, p.name
  LIMIT limit_count;
END;
$$;

-- Add RLS policies for the search functions
CREATE POLICY "Users can search products in their business" 
  ON public.products 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = products.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = products.business_id AND owner_id = auth.uid()
    )
  );
