
-- אוטומציה 1: טבלת התראות מלאי
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  supplier_name TEXT,
  supplier_phone TEXT,
  quantity_at_trigger INTEGER NOT NULL,
  alert_type TEXT NOT NULL, -- 'out_of_stock', 'expiration_soon', 'low_stock'
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON public.stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_business_id ON public.stock_alerts(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_alert_type ON public.stock_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON public.stock_alerts(created_at);

-- RLS לטבלת stock_alerts
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- בעלי עסק יכולים לנהל התראות של העסק שלהם
CREATE POLICY "Business owners can manage their stock alerts" 
ON public.stock_alerts FOR ALL 
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- המערכת יכולה להכניס התראות חדשות
CREATE POLICY "System can insert stock alerts" 
ON public.stock_alerts FOR INSERT 
WITH CHECK (true);

-- אוטומציה 2: View למוצרים ישנים (מעל 60 יום ללא תנועה)
CREATE OR REPLACE VIEW public.stale_products AS
SELECT 
  p.id,
  p.name,
  p.quantity,
  p.business_id,
  p.location,
  p.cost,
  p.price,
  p.created_at as product_created_at,
  COALESCE(MAX(ia.timestamp), p.created_at) as last_activity,
  EXTRACT(days FROM (now() - COALESCE(MAX(ia.timestamp), p.created_at))) as days_since_activity
FROM public.products p
LEFT JOIN public.inventory_actions ia ON p.id = ia.product_id
GROUP BY p.id, p.name, p.quantity, p.business_id, p.location, p.cost, p.price, p.created_at
HAVING EXTRACT(days FROM (now() - COALESCE(MAX(ia.timestamp), p.created_at))) > 60
ORDER BY days_since_activity DESC;

-- הרשאות לview
GRANT SELECT ON public.stale_products TO authenticated;

-- אוטומציה 5: טבלת תיעוד פעולות עובדים
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'product', 'supplier', 'inventory_action'
  entity_id UUID,
  entity_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_business_id ON public.user_activity_log(business_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_timestamp ON public.user_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_entity_type ON public.user_activity_log(entity_type);

-- RLS לטבלת user_activity_log
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- בעלי עסק יכולים לראות לוגים של העסק שלהם
CREATE POLICY "Business owners can view their business activity logs" 
ON public.user_activity_log FOR SELECT 
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- המערכת יכולה להכניס לוגים
CREATE POLICY "System can insert activity logs" 
ON public.user_activity_log FOR INSERT 
WITH CHECK (true);

-- פונקציה לרישום פעילות עובדים
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_entity_name TEXT,
  p_business_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.user_activity_log (
    user_id,
    business_id,
    action_type,
    entity_type,
    entity_id,
    entity_name,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_business_id,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- פונקציה לזיהוי מוצרים עם תוקף קרוב
CREATE OR REPLACE FUNCTION public.get_expiring_products(
  days_ahead INTEGER DEFAULT 7,
  target_business_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  expiration_date DATE,
  days_until_expiry INTEGER,
  business_id UUID,
  supplier_name TEXT,
  quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.expiration_date,
    EXTRACT(days FROM (p.expiration_date - CURRENT_DATE))::INTEGER as days_until_expiry,
    p.business_id,
    COALESCE(s.name, 'ללא ספק') as supplier_name,
    p.quantity
  FROM public.products p
  LEFT JOIN public.suppliers s ON p.supplier_id = s.id
  WHERE 
    p.expiration_date IS NOT NULL
    AND p.expiration_date <= CURRENT_DATE + (days_ahead || ' days')::INTERVAL
    AND p.expiration_date >= CURRENT_DATE
    AND (target_business_id IS NULL OR p.business_id = target_business_id)
  ORDER BY p.expiration_date ASC;
END;
$$;

-- פונקציה לדו"ח שבועי של מלאי
CREATE OR REPLACE FUNCTION public.generate_weekly_stock_summary(
  target_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  summary JSONB;
  total_products INTEGER;
  out_of_stock_count INTEGER;
  low_stock_count INTEGER;
  expiring_soon_count INTEGER;
  stale_products_count INTEGER;
BEGIN
  -- סך כל המוצרים
  SELECT COUNT(*) INTO total_products
  FROM public.products
  WHERE business_id = target_business_id;
  
  -- מוצרים שאזלו
  SELECT COUNT(*) INTO out_of_stock_count
  FROM public.products
  WHERE business_id = target_business_id AND quantity = 0;
  
  -- מוצרים במלאי נמוך (פחות מ-5)
  SELECT COUNT(*) INTO low_stock_count
  FROM public.products
  WHERE business_id = target_business_id AND quantity > 0 AND quantity < 5;
  
  -- מוצרים עם תוקף קרוב (7 ימים)
  SELECT COUNT(*) INTO expiring_soon_count
  FROM public.products
  WHERE business_id = target_business_id 
    AND expiration_date IS NOT NULL
    AND expiration_date <= CURRENT_DATE + INTERVAL '7 days'
    AND expiration_date >= CURRENT_DATE;
  
  -- מוצרים ישנים (מעל 60 יום ללא תנועה)
  SELECT COUNT(*) INTO stale_products_count
  FROM public.stale_products
  WHERE business_id = target_business_id;
  
  -- בניית JSON של הסיכום
  summary := jsonb_build_object(
    'business_id', target_business_id,
    'report_date', CURRENT_DATE,
    'total_products', total_products,
    'out_of_stock_count', out_of_stock_count,
    'low_stock_count', low_stock_count,
    'expiring_soon_count', expiring_soon_count,
    'stale_products_count', stale_products_count,
    'generated_at', now()
  );
  
  RETURN summary;
END;
$$;
