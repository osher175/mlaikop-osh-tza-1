
-- Create notifications table to store all notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('low_stock', 'expired_product', 'plan_limit')),
  title text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create notification settings table for business-specific preferences
CREATE TABLE public.notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  low_stock_enabled boolean NOT NULL DEFAULT true,
  expiration_enabled boolean NOT NULL DEFAULT true,
  plan_limit_enabled boolean NOT NULL DEFAULT true,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  expiration_days_warning integer NOT NULL DEFAULT 7,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Create product-specific thresholds table
CREATE TABLE public.product_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Enable RLS on all notification tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications - users can only see notifications for their business
CREATE POLICY "Users can view notifications for their business" 
  ON public.notifications 
  FOR SELECT 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update notifications for their business" 
  ON public.notifications 
  FOR UPDATE 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "System can insert notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (true);

-- RLS policies for notification settings
CREATE POLICY "Users can manage notification settings for their business" 
  ON public.notification_settings 
  FOR ALL 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- RLS policies for product thresholds
CREATE POLICY "Users can manage product thresholds for their business" 
  ON public.product_thresholds 
  FOR ALL 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Function to create notifications when products are low on stock
CREATE OR REPLACE FUNCTION public.check_low_stock_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert low stock notifications for products below threshold
  INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
  SELECT DISTINCT
    p.business_id,
    b.owner_id,
    'low_stock'::text,
    'מלאי נמוך'::text,
    'המלאי של ' || p.name || ' נמוך מהסף שהוגדר (' || p.quantity || ' יחידות)'::text,
    p.id
  FROM public.products p
  JOIN public.businesses b ON p.business_id = b.id
  LEFT JOIN public.product_thresholds pt ON p.id = pt.product_id
  JOIN public.notification_settings ns ON p.business_id = ns.business_id
  WHERE 
    ns.low_stock_enabled = true
    AND p.quantity <= COALESCE(pt.low_stock_threshold, ns.low_stock_threshold)
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.product_id = p.id 
      AND n.type = 'low_stock' 
      AND n.created_at > now() - interval '24 hours'
    );
END;
$$;

-- Function to create notifications for expired/expiring products
CREATE OR REPLACE FUNCTION public.check_expiration_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert expiration notifications for products that are expired or expiring soon
  INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
  SELECT DISTINCT
    p.business_id,
    b.owner_id,
    'expired_product'::text,
    CASE 
      WHEN p.expiration_date < CURRENT_DATE THEN 'מוצר פג תוקף'::text
      ELSE 'מוצר קרוב לפגות תוקף'::text
    END,
    CASE 
      WHEN p.expiration_date < CURRENT_DATE THEN 
        p.name || ' פג תוקף בתאריך ' || to_char(p.expiration_date, 'DD/MM/YYYY')
      ELSE 
        p.name || ' יפוג תוקף בתאריך ' || to_char(p.expiration_date, 'DD/MM/YYYY')
    END,
    p.id
  FROM public.products p
  JOIN public.businesses b ON p.business_id = b.id
  JOIN public.notification_settings ns ON p.business_id = ns.business_id
  WHERE 
    ns.expiration_enabled = true
    AND p.expiration_date IS NOT NULL
    AND p.expiration_date <= CURRENT_DATE + (ns.expiration_days_warning || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.product_id = p.id 
      AND n.type = 'expired_product' 
      AND n.created_at > now() - interval '24 hours'
    );
END;
$$;
