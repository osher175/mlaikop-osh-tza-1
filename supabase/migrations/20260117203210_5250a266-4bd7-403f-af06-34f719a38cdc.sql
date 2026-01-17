-- Fix remaining functions with missing search_path

-- 1. check_low_stock_notifications
CREATE OR REPLACE FUNCTION public.check_low_stock_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- 2. check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(user_email text, user_ip inet DEFAULT NULL::inet, max_attempts integer DEFAULT 5, time_window_minutes integer DEFAULT 15)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INTEGER;
  ip_attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.login_attempts
  WHERE email = user_email
    AND success = false
    AND attempted_at > (now() - (time_window_minutes || ' minutes')::interval);
  
  IF user_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_attempt_count
    FROM public.login_attempts
    WHERE ip_address = user_ip
      AND success = false
      AND attempted_at > (now() - (time_window_minutes || ' minutes')::interval);
    
    IF ip_attempt_count >= (max_attempts * 2) THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN attempt_count < max_attempts;
END;
$$;

-- 3. get_users_for_admin_search
CREATE OR REPLACE FUNCTION public.get_users_for_admin_search(search_pattern text)
RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, role user_role, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.first_name, '') as first_name,
    COALESCE(p.last_name, '') as last_name,
    COALESCE(ur.role, 'free_user'::user_role) as role,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE 
    u.email ILIKE search_pattern OR
    p.first_name ILIKE search_pattern OR
    p.last_name ILIKE search_pattern
  ORDER BY u.created_at DESC
  LIMIT 20;
END;
$$;

-- 4. search_users_for_admin
CREATE OR REPLACE FUNCTION public.search_users_for_admin(search_pattern text)
RETURNS TABLE(user_id uuid, email text, first_name text, last_name text, is_active boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(e.email, au.email) as email,
    COALESCE(p.first_name, '') as first_name,
    COALESCE(p.last_name, '') as last_name,
    p.is_active,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.emails e ON p.id = e.user_id
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE 
    (search_pattern = '' OR 
     p.first_name ILIKE '%' || search_pattern || '%' OR
     p.last_name ILIKE '%' || search_pattern || '%' OR
     e.email ILIKE '%' || search_pattern || '%' OR
     au.email ILIKE '%' || search_pattern || '%')
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$$;

-- 5. handle_subscription_change
CREATE OR REPLACE FUNCTION public.handle_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    UPDATE public.user_subscriptions_new 
    SET status = 'expired', updated_at = now()
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. log_user_email
CREATE OR REPLACE FUNCTION public.log_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.emails (email, user_id)
  VALUES (NEW.email, NEW.id);
  
  RETURN NEW;
END;
$$;

-- 7. toggle_user_active_status
CREATE OR REPLACE FUNCTION public.toggle_user_active_status(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status boolean;
BEGIN
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  UPDATE public.profiles 
  SET is_active = NOT is_active, updated_at = now()
  WHERE id = target_user_id
  RETURNING is_active INTO new_status;

  RETURN new_status;
END;
$$;

-- 8. log_login_attempt
CREATE OR REPLACE FUNCTION public.log_login_attempt(user_email text, user_ip inet DEFAULT NULL::inet, is_success boolean DEFAULT false, user_agent_string text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success, user_agent)
  VALUES (user_email, user_ip, is_success, user_agent_string);
  
  DELETE FROM public.login_attempts
  WHERE attempted_at < (now() - interval '24 hours');
END;
$$;

-- 9. log_product_activity
CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  business_uuid uuid;
  action_title text;
  action_type_val text;
  status_color_val text;
  priority_val text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    business_uuid := OLD.business_id;
  ELSE
    business_uuid := COALESCE(NEW.business_id, OLD.business_id);
  END IF;
  
  IF business_uuid IS NULL THEN
    RAISE LOG 'Cannot log activity: business_id is null for product operation %', TG_OP;
    RETURN COALESCE(NEW, OLD);
  END IF;
  
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
      
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.quantity != OLD.quantity THEN
        IF NEW.quantity > OLD.quantity THEN
          action_title := 'הוסף למלאי - ' || NEW.name || ' (+' || (NEW.quantity - OLD.quantity) || ')';
          action_type_val := 'inventory_added';
          status_color_val := 'success';
        ELSE
          action_title := 'הפחת מהמלאי - ' || NEW.name || ' (-' || (OLD.quantity - NEW.quantity) || ')';
          action_type_val := 'inventory_reduced';
          status_color_val := 'warning';
          
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
      RAISE LOG 'Error in log_product_activity trigger: % - %', SQLERRM, SQLSTATE;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 10. log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(p_action_type text, p_target_type text DEFAULT NULL::text, p_target_id uuid DEFAULT NULL::uuid, p_business_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action_type,
    target_type,
    target_id,
    business_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_type,
    p_target_id,
    p_business_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- 11. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  IF NEW.email = 'oshritzafriri@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user');
  
  RETURN NEW;
END;
$$;

-- 12. audit_products_changes
CREATE OR REPLACE FUNCTION public.audit_products_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(
      'product_created',
      'product',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'product_name', NEW.name,
        'quantity', NEW.quantity,
        'cost', NEW.cost,
        'price', NEW.price
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(
      'product_updated',
      'product',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'old_values', jsonb_build_object(
          'name', OLD.name,
          'quantity', OLD.quantity,
          'cost', OLD.cost,
          'price', OLD.price
        ),
        'new_values', jsonb_build_object(
          'name', NEW.name,
          'quantity', NEW.quantity,
          'cost', NEW.cost,
          'price', NEW.price
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(
      'product_deleted',
      'product',
      OLD.id,
      OLD.business_id,
      jsonb_build_object(
        'product_name', OLD.name,
        'quantity', OLD.quantity
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;