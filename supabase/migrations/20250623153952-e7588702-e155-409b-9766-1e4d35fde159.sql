
-- First, let's check and fix the foreign key constraint for recent_activity.product_id
-- to ensure it handles product deletion properly
ALTER TABLE public.recent_activity 
DROP CONSTRAINT IF EXISTS recent_activity_product_id_fkey;

-- Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.recent_activity 
ADD CONSTRAINT recent_activity_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Now let's fix the log_product_activity trigger with better error handling and logging
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
  current_user_id uuid;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- Get business_id for the product BEFORE any operation
  IF TG_OP = 'DELETE' THEN
    business_uuid := OLD.business_id;
  ELSE
    business_uuid := COALESCE(NEW.business_id, OLD.business_id);
  END IF;
  
  -- Ensure we have a valid business_id
  IF business_uuid IS NULL THEN
    RAISE LOG 'Cannot log activity: business_id is null for product operation %', TG_OP;
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Ensure we have a valid user_id for logging
  IF current_user_id IS NULL AND TG_OP = 'INSERT' THEN
    current_user_id := NEW.created_by;
  ELSIF current_user_id IS NULL AND TG_OP = 'UPDATE' THEN
    current_user_id := OLD.created_by;
  ELSIF current_user_id IS NULL AND TG_OP = 'DELETE' THEN
    current_user_id := OLD.created_by;
  END IF;
  
  IF current_user_id IS NULL THEN
    RAISE LOG 'Cannot log activity: user_id is null for product operation %', TG_OP;
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  BEGIN
    IF TG_OP = 'INSERT' THEN
      action_title := 'הוסף מוצר חדש - ' || NEW.name;
      action_type_val := 'product_added';
      status_color_val := 'success';
      priority_val := 'medium';
      
      INSERT INTO public.recent_activity (
        business_id, user_id, action_type, title, product_id, 
        priority_level, status_color, is_system_generated, timestamp
      ) VALUES (
        business_uuid, current_user_id, action_type_val, action_title, NEW.id,
        priority_val, status_color_val, false, now()
      );
      
      RAISE LOG 'Successfully logged product creation: % (ID: %)', NEW.name, NEW.id;
      
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
              priority_level, status_color, is_system_generated, is_critical, timestamp
            ) VALUES (
              business_uuid, current_user_id, 'out_of_stock', 'המוצר אזל מהמלאי - ' || NEW.name, NEW.id,
              'high', 'error', true, true, now()
            );
          END IF;
        END IF;
        
        INSERT INTO public.recent_activity (
          business_id, user_id, action_type, title, product_id,
          quantity_changed, priority_level, status_color, is_system_generated, timestamp
        ) VALUES (
          business_uuid, current_user_id, action_type_val, action_title, NEW.id,
          NEW.quantity - OLD.quantity, 'medium', status_color_val, false, now()
        );
      END IF;
      
    ELSIF TG_OP = 'DELETE' THEN
      action_title := 'מחק מוצר - ' || OLD.name;
      action_type_val := 'product_deleted';
      status_color_val := 'error';
      priority_val := 'high';
      
      -- For DELETE operations, do NOT include product_id to avoid foreign key issues
      INSERT INTO public.recent_activity (
        business_id, user_id, action_type, title,
        priority_level, status_color, is_system_generated, timestamp
      ) VALUES (
        business_uuid, current_user_id, action_type_val, action_title,
        priority_val, status_color_val, false, now()
      );
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the main operation
      RAISE LOG 'Error in log_product_activity trigger: % - %', SQLERRM, SQLSTATE;
      RAISE LOG 'Operation: %, Business ID: %, User ID: %', TG_OP, business_uuid, current_user_id;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add RLS policies for recent_activity table if they don't exist
DO $$
BEGIN
  -- Check if RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'recent_activity' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Add policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'recent_activity' 
    AND policyname = 'Users can view recent activity for their business'
  ) THEN
    CREATE POLICY "Users can view recent activity for their business" 
      ON public.recent_activity 
      FOR SELECT 
      USING (
        business_id IN (
          SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        ) OR
        business_id IN (
          SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND status = 'approved'
        )
      );
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'recent_activity' 
    AND policyname = 'System can insert recent activity'
  ) THEN
    CREATE POLICY "System can insert recent activity" 
      ON public.recent_activity 
      FOR INSERT 
      WITH CHECK (true);
  END IF;
END
$$;
