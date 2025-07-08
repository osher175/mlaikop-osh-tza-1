
-- יצירת טבלת audit_logs למעקב אחר פעולות רגישות
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT, -- 'product', 'supplier', 'user', 'email', etc.
  target_id UUID,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  details JSONB, -- פרטים נוספים על הפעולה
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- אינדקסים לביצועים טובים
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON public.audit_logs(business_id);

-- RLS לטבלת audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- רק admin יכול לראות את כל הלוגים
CREATE POLICY "Only admins can view all audit logs" 
ON public.audit_logs FOR SELECT 
USING (public.has_role_or_higher('admin'::user_role));

-- בעלי עסק יכולים לראות לוגים של העסק שלהם
CREATE POLICY "Business owners can view their business audit logs" 
ON public.audit_logs FOR SELECT 
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- המערכת יכולה להכניס לוגים
CREATE POLICY "System can insert audit logs" 
ON public.audit_logs FOR INSERT 
WITH CHECK (true);

-- פונקציה לרישום audit log
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_business_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
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

-- טריגר לרישום אוטומטי של שינויים במוצרים
CREATE OR REPLACE FUNCTION public.audit_products_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- יצירת הטריגר למוצרים
DROP TRIGGER IF EXISTS audit_products_trigger ON public.products;
CREATE TRIGGER audit_products_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_products_changes();

-- טריגר לרישום אוטומטי של שינויים בספקים
CREATE OR REPLACE FUNCTION public.audit_suppliers_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- יצירת הטריגר לספקים
DROP TRIGGER IF EXISTS audit_suppliers_trigger ON public.suppliers;
CREATE TRIGGER audit_suppliers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.audit_suppliers_changes();

-- טריגר לרישום login attempts
CREATE OR REPLACE FUNCTION public.audit_login_attempts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- רישום רק של כניסות מוצלחות לaudit log
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

-- יצירת הטריגר ל-login attempts
DROP TRIGGER IF EXISTS audit_login_trigger ON public.login_attempts;
CREATE TRIGGER audit_login_trigger
  AFTER INSERT ON public.login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.audit_login_attempts();

-- ניקוי לוגים ישנים (מעל 90 יום)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < (now() - interval '90 days');
END;
$$;
