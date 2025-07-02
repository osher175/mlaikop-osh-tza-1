
-- Fix the log_product_activity trigger to properly handle business_id in DELETE operations
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
  -- Get business_id for the product BEFORE any operation
  IF TG_OP = 'DELETE' THEN
    business_uuid := OLD.business_id;
  ELSE
    business_uuid := COALESCE(NEW.business_id, OLD.business_id);
  END IF;
  
  -- Ensure we have a valid business_id
  IF business_uuid IS NULL THEN
    RAISE WARNING 'Cannot log activity: business_id is null for product operation';
    RETURN COALESCE(NEW, OLD);
  END IF;
  
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
