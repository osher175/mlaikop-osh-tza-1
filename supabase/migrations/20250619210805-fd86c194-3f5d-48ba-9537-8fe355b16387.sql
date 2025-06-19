
-- Create the recent_activity table to track all user actions
CREATE TABLE public.recent_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity_changed integer,
  priority_level text NOT NULL DEFAULT 'medium' CHECK (priority_level IN ('high', 'medium', 'low')),
  status_color text NOT NULL DEFAULT 'info' CHECK (status_color IN ('success', 'warning', 'error', 'info')),
  icon_name text,
  is_system_generated boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for business-level security
ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;

-- Users can only see activities from their own business
CREATE POLICY "Users can view activities for their business" 
  ON public.recent_activity 
  FOR SELECT 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- System can insert activities (for triggers)
CREATE POLICY "System can insert activities" 
  ON public.recent_activity 
  FOR INSERT 
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_recent_activity_business_timestamp ON public.recent_activity(business_id, timestamp DESC);
CREATE INDEX idx_recent_activity_user_id ON public.recent_activity(user_id);
CREATE INDEX idx_recent_activity_product_id ON public.recent_activity(product_id) WHERE product_id IS NOT NULL;

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.recent_activity;

-- Function to automatically log product actions
CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  business_uuid uuid;
  action_title text;
  action_type_val text;
  status_color_val text;
  priority_val text;
BEGIN
  -- Get business_id for the product
  SELECT business_id INTO business_uuid FROM public.products WHERE id = COALESCE(NEW.id, OLD.id);
  
  IF TG_OP = 'INSERT' THEN
    action_title := 'הוסף מוצר חדש - ' || NEW.name;
    action_type_val := 'product_added';
    status_color_val := 'success';
    priority_val := 'medium';
    
    INSERT INTO public.recent_activity (
      business_id, user_id, action_type, title, product_id, 
      priority_level, status_color, is_system_generated
    ) VALUES (
      business_uuid, NEW.created_by, action_type_val, action_title, NEW.id,
      priority_val, status_color_val, false
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if quantity changed
    IF NEW.quantity != OLD.quantity THEN
      IF NEW.quantity > OLD.quantity THEN
        action_title := 'הוסף למלאי - ' || NEW.name || ' (+' || (NEW.quantity - OLD.quantity) || ')';
        action_type_val := 'inventory_added';
        status_color_val := 'success';
      ELSE
        action_title := 'הפחת מהמלאי - ' || NEW.name || ' (-' || (OLD.quantity - NEW.quantity) || ')';
        action_type_val := 'inventory_reduced';
        status_color_val := 'warning';
        
        -- Check if product is now out of stock
        IF NEW.quantity = 0 THEN
          INSERT INTO public.recent_activity (
            business_id, user_id, action_type, title, product_id,
            priority_level, status_color, is_system_generated, is_critical
          ) VALUES (
            business_uuid, auth.uid(), 'out_of_stock', 'המוצר אזל מהמלאי - ' || NEW.name, NEW.id,
            'high', 'error', true, true
          );
        END IF;
      END IF;
      
      INSERT INTO public.recent_activity (
        business_id, user_id, action_type, title, product_id,
        quantity_changed, priority_level, status_color, is_system_generated
      ) VALUES (
        business_uuid, COALESCE(auth.uid(), OLD.created_by), action_type_val, action_title, NEW.id,
        NEW.quantity - OLD.quantity, 'medium', status_color_val, false
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    action_title := 'מחק מוצר - ' || OLD.name;
    action_type_val := 'product_deleted';
    status_color_val := 'error';
    priority_val := 'high';
    
    INSERT INTO public.recent_activity (
      business_id, user_id, action_type, title, product_id,
      priority_level, status_color, is_system_generated
    ) VALUES (
      business_uuid, COALESCE(auth.uid(), OLD.created_by), action_type_val, action_title, OLD.id,
      priority_val, status_color_val, false
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for automatic activity logging
CREATE TRIGGER trigger_log_product_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();

-- Insert some sample data for testing (will be automatically filtered by RLS)
INSERT INTO public.recent_activity (
  business_id, user_id, action_type, title, priority_level, status_color, is_system_generated
) 
SELECT 
  b.id, 
  b.owner_id, 
  'system_startup', 
  'המערכת הופעלה', 
  'low', 
  'info', 
  true
FROM public.businesses b 
LIMIT 5;
