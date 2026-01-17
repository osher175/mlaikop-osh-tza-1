-- Continue fixing remaining functions with missing search_path

-- 1. is_first_user_in_business
CREATE OR REPLACE FUNCTION public.is_first_user_in_business(business_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.business_id = business_uuid
  );
$$;

-- 2. get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid DEFAULT auth.uid())
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = user_uuid),
    'free_user'::user_role
  );
$$;

-- 3. has_role_or_higher
CREATE OR REPLACE FUNCTION public.has_role_or_higher(required_role user_role, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.get_user_role(user_uuid)
    WHEN 'admin' THEN true
    WHEN 'OWNER' THEN required_role IN ('OWNER', 'elite_pilot_user', 'smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'elite_pilot_user' THEN required_role IN ('elite_pilot_user', 'smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'smart_master_user' THEN required_role IN ('smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'pro_starter_user' THEN required_role IN ('pro_starter_user', 'free_user')
    WHEN 'free_user' THEN required_role = 'free_user'
    ELSE false
  END;
$$;

-- 4. check_expiration_notifications
CREATE OR REPLACE FUNCTION public.check_expiration_notifications()
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
    'expired'::text,
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
      AND n.type = 'expired' 
      AND n.created_at > now() - interval '24 hours'
    );
END;
$$;

-- 5. user_has_business_access
CREATE OR REPLACE FUNCTION public.user_has_business_access(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.business_users 
    WHERE user_id = user_uuid AND status = 'approved'
  );
$$;

-- 6. get_user_business_context
CREATE OR REPLACE FUNCTION public.get_user_business_context(user_uuid uuid DEFAULT auth.uid())
RETURNS TABLE(business_id uuid, business_name text, user_role text, is_owner boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, 'OWNER'::TEXT, true
  FROM public.businesses b
  WHERE b.owner_id = user_uuid
  
  UNION ALL
  
  SELECT b.id, b.name, bu.role, false
  FROM public.businesses b
  JOIN public.business_users bu ON b.id = bu.business_id
  WHERE bu.user_id = user_uuid AND bu.status = 'approved'
  
  LIMIT 1;
$$;

-- 7. is_business_name_available
CREATE OR REPLACE FUNCTION public.is_business_name_available(business_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE LOWER(name) = LOWER(business_name)
  );
$$;

-- 8. check_product_notifications
CREATE OR REPLACE FUNCTION public.check_product_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  low_stock_threshold_val integer;
  business_owner_id uuid;
BEGIN
  SELECT owner_id INTO business_owner_id 
  FROM public.businesses 
  WHERE id = NEW.business_id;
  
  IF business_owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND (OLD.quantity IS DISTINCT FROM NEW.quantity) OR TG_OP = 'INSERT' THEN
    SELECT COALESCE(pt.low_stock_threshold, ns.low_stock_threshold) 
    INTO low_stock_threshold_val
    FROM public.notification_settings ns
    LEFT JOIN public.product_thresholds pt ON pt.product_id = NEW.id
    WHERE ns.business_id = NEW.business_id;
    
    IF low_stock_threshold_val IS NOT NULL AND NEW.quantity <= low_stock_threshold_val THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE product_id = NEW.id 
        AND type = 'low_stock' 
        AND created_at > now() - interval '24 hours'
      ) THEN
        INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
        VALUES (
          NEW.business_id,
          business_owner_id,
          'low_stock',
          'מלאי נמוך',
          'המלאי של ' || NEW.name || ' נמוך מהסף שהוגדר (' || NEW.quantity || ' יחידות)',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  IF NEW.expiration_date IS NOT NULL THEN
    DECLARE
      warning_days integer;
    BEGIN
      SELECT expiration_days_warning 
      INTO warning_days
      FROM public.notification_settings 
      WHERE business_id = NEW.business_id 
      AND expiration_enabled = true;
      
      IF warning_days IS NOT NULL AND 
         NEW.expiration_date <= CURRENT_DATE + (warning_days || ' days')::interval THEN
        
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications 
          WHERE product_id = NEW.id 
          AND type = 'expired' 
          AND created_at > now() - interval '24 hours'
        ) THEN
          INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
          VALUES (
            NEW.business_id,
            business_owner_id,
            'expired',
            CASE 
              WHEN NEW.expiration_date < CURRENT_DATE THEN 'מוצר פג תוקף'
              ELSE 'מוצר קרוב לפגות תוקף'
            END,
            CASE 
              WHEN NEW.expiration_date < CURRENT_DATE THEN 
                NEW.name || ' פג תוקף בתאריך ' || to_char(NEW.expiration_date, 'DD/MM/YYYY')
              ELSE 
                NEW.name || ' יפוג תוקף בתאריך ' || to_char(NEW.expiration_date, 'DD/MM/YYYY')
            END,
            NEW.id
          );
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 9. audit_suppliers_changes
CREATE OR REPLACE FUNCTION public.audit_suppliers_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit_event(
      'supplier_created',
      'supplier',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'supplier_name', NEW.name,
        'contact_email', NEW.contact_email,
        'phone', NEW.phone
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(
      'supplier_updated',
      'supplier',
      NEW.id,
      NEW.business_id,
      jsonb_build_object(
        'old_values', jsonb_build_object(
          'name', OLD.name,
          'contact_email', OLD.contact_email,
          'phone', OLD.phone
        ),
        'new_values', jsonb_build_object(
          'name', NEW.name,
          'contact_email', NEW.contact_email,
          'phone', NEW.phone
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit_event(
      'supplier_deleted',
      'supplier',
      OLD.id,
      OLD.business_id,
      jsonb_build_object(
        'supplier_name', OLD.name
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 10. audit_login_attempts
CREATE OR REPLACE FUNCTION public.audit_login_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.success = true THEN
    PERFORM public.log_audit_event(
      'login_success',
      'auth',
      NULL,
      NULL,
      jsonb_build_object(
        'email', NEW.email,
        'login_time', NEW.attempted_at
      ),
      NEW.ip_address,
      NEW.user_agent
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 11. cleanup_old_audit_logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < (now() - interval '90 days');
END;
$$;

-- 12. delete_user_by_admin
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RAISE LOG 'Admin user deletion started for user ID: %', target_user_id;

  DELETE FROM auth.users WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE LOG 'User ID % not found in auth.users', target_user_id;
    RETURN false;
  END IF;
  
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM public.emails WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  RAISE LOG 'Admin user deletion completed successfully for user ID: %', target_user_id;
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in delete_user_by_admin for user ID %: % - %', target_user_id, SQLERRM, SQLSTATE;
    RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$;

-- 13. log_user_activity
CREATE OR REPLACE FUNCTION public.log_user_activity(p_action_type text, p_entity_type text, p_entity_id uuid, p_entity_name text, p_business_id uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 14. generate_weekly_stock_summary
CREATE OR REPLACE FUNCTION public.generate_weekly_stock_summary(target_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  summary JSONB;
  total_products INTEGER;
  out_of_stock_count INTEGER;
  low_stock_count INTEGER;
  expiring_soon_count INTEGER;
BEGIN
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
$$;

-- 15. reports_aggregate
CREATE OR REPLACE FUNCTION public.reports_aggregate(business_id uuid, date_from timestamp with time zone, date_to timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_added integer;
  total_removed integer;
  total_value numeric;
  gross_profit numeric;
  net_profit numeric;
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM(ia.quantity_changed), 0)
    INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0)
    INTO total_removed
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  SELECT COALESCE(SUM(ia.quantity_changed * p.cost), 0)
    INTO total_value
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  SELECT COALESCE(SUM((p.price - p.cost) * ABS(ia.quantity_changed)), 0)
    INTO gross_profit
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  net_profit := ROUND(gross_profit * 0.83, 2);

  SELECT p.name
    INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', p.supplier_id,
        'total_purchased', SUM(ia.quantity_changed)
      ))
      INTO suppliers_breakdown
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY p.supplier_id;
  EXCEPTION WHEN OTHERS THEN
    suppliers_breakdown := '[]'::jsonb;
  END;

  SELECT jsonb_agg(row_to_json(t))
    INTO timeline_breakdown
  FROM (
    SELECT
      to_char(ia.timestamp, 'YYYY-MM-DD') as date,
      SUM(ABS(ia.quantity_changed)) as sales
    FROM public.inventory_actions ia
    WHERE ia.action_type = 'remove'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  RETURN jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', gross_profit,
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', suppliers_breakdown,
    'timeline_breakdown', timeline_breakdown
  );
END;
$$;

-- 16. log_whatsapp_notification_stock_zero
CREATE OR REPLACE FUNCTION public.log_whatsapp_notification_stock_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supplier_phone text;
BEGIN
  IF NEW.quantity = 0 AND OLD.quantity > 0 AND NEW.supplier_id IS NOT NULL THEN
    
    SELECT phone INTO supplier_phone
    FROM public.suppliers
    WHERE id = NEW.supplier_id;
    
    IF supplier_phone IS NOT NULL AND supplier_phone != '' THEN
      INSERT INTO public.whatsapp_notifications_log (
        business_id,
        product_id,
        supplier_id,
        message_text,
        sales_agent_phone,
        recipient_phone,
        trigger_type,
        was_sent
      ) VALUES (
        NEW.business_id,
        NEW.id,
        NEW.supplier_id,
        'המוצר ' || NEW.name || ' אזל מהמלאי.',
        '',
        supplier_phone,
        'stock_zero',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 17. process_approved_stock_request
CREATE OR REPLACE FUNCTION public.process_approved_stock_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response http_response;
  request_body text;
  headers text;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    
    request_body := json_build_object(
      'product_id', NEW.product_id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'supplier_id', NEW.supplier_id
    )::text;
    
    headers := json_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
      'Content-Type', 'application/json'
    )::text;
    
    SELECT INTO response public.http_post(
      'https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/clever-service',
      request_body,
      headers
    );
    
    IF response.status >= 200 AND response.status < 300 THEN
      INSERT INTO public.whatsapp_notifications_log (
        business_id,
        product_id,
        supplier_id,
        message_text,
        sales_agent_phone,
        recipient_phone,
        trigger_type,
        was_sent
      ) 
      SELECT
        p.business_id,
        NEW.product_id,
        NEW.supplier_id,
        'הודעה נשלחה לאחר אישור ידני עבור המוצר: ' || NEW.product_name,
        '',
        s.phone,
        'manual_approval_out_of_stock',
        true
      FROM public.products p
      LEFT JOIN public.suppliers s ON s.id = NEW.supplier_id
      WHERE p.id = NEW.product_id;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- 18. autofill_recipient_phone
CREATE OR REPLACE FUNCTION public.autofill_recipient_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT phone INTO NEW.recipient_phone
  FROM public.suppliers
  WHERE id = NEW.supplier_id;

  RETURN NEW;
END;
$$;

-- 19. notify_out_of_stock
CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN
    
    INSERT INTO public.stock_approval_requests (
      product_id, 
      supplier_id, 
      product_name, 
      quantity
    ) VALUES (
      NEW.id, 
      NEW.supplier_id, 
      NEW.name, 
      NEW.quantity
    );
    
  END IF;

  RETURN NEW;
END;
$$;