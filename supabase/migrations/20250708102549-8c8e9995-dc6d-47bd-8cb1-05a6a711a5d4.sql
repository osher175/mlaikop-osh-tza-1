
-- השלמת הגנת RLS לטבלת emails
-- הוספת מדיניות UPDATE - רק admin יכול לעדכן
CREATE POLICY "Only admins can update emails" 
ON public.emails FOR UPDATE 
USING (public.has_role_or_higher('admin'::user_role))
WITH CHECK (public.has_role_or_higher('admin'::user_role));

-- הוספת מדיניות DELETE - רק admin יכול למחוק
CREATE POLICY "Only admins can delete emails" 
ON public.emails FOR DELETE 
USING (public.has_role_or_higher('admin'::user_role));

-- השלמת הגנת RLS לטבלת permissions
-- הוספת מדיניות INSERT - רק admin יכול להוסיף הרשאות
CREATE POLICY "Only admins can insert permissions" 
ON public.permissions FOR INSERT 
WITH CHECK (public.get_user_role() = 'admin'::user_role);

-- הוספת מדיניות UPDATE - רק admin יכול לעדכן הרשאות
CREATE POLICY "Only admins can update permissions" 
ON public.permissions FOR UPDATE 
USING (public.get_user_role() = 'admin'::user_role)
WITH CHECK (public.get_user_role() = 'admin'::user_role);

-- הוספת מדיניות DELETE - רק admin יכול למחוק הרשאות
CREATE POLICY "Only admins can delete permissions" 
ON public.permissions FOR DELETE 
USING (public.get_user_role() = 'admin'::user_role);

-- השלמת הגנת RLS לטבלת user_subscriptions_new
-- הוספת מדיניות UPDATE - רק admin או בעל המנוי יכול לעדכן
CREATE POLICY "Users and admins can update subscriptions" 
ON public.user_subscriptions_new FOR UPDATE 
USING (
  public.get_user_role() = 'admin'::user_role OR 
  auth.uid() = user_id
)
WITH CHECK (
  public.get_user_role() = 'admin'::user_role OR 
  auth.uid() = user_id
);

-- הוספת מדיניות DELETE - רק admin יכול למחוק מנויים
CREATE POLICY "Only admins can delete subscriptions" 
ON public.user_subscriptions_new FOR DELETE 
USING (public.get_user_role() = 'admin'::user_role);

-- השלמת הגנת RLS לטבלת product_categories
-- הוספת מדיניות UPDATE - רק משתמשים עם גישה לעסק הרלוונטי
CREATE POLICY "Users can update product categories in their business context" 
ON public.product_categories FOR UPDATE 
USING (
  business_category_id IN (
    SELECT bc.id FROM public.business_categories bc
    JOIN public.businesses b ON b.business_category_id = bc.id
    WHERE b.owner_id = auth.uid()
  )
)
WITH CHECK (
  business_category_id IN (
    SELECT bc.id FROM public.business_categories bc
    JOIN public.businesses b ON b.business_category_id = bc.id
    WHERE b.owner_id = auth.uid()
  )
);

-- הוספת מדיניות DELETE - רק משתמשים עם גישה לעסק הרלוונטי
CREATE POLICY "Users can delete product categories in their business context" 
ON public.product_categories FOR DELETE 
USING (
  business_category_id IN (
    SELECT bc.id FROM public.business_categories bc
    JOIN public.businesses b ON b.business_category_id = bc.id
    WHERE b.owner_id = auth.uid()
  )
);

-- יצירת טבלה לעקיבת ניסיונות כניסה (Rate Limiting)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT
);

-- הוספת אינדקס לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
ON public.login_attempts(email, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
ON public.login_attempts(ip_address, attempted_at);

-- RLS לטבלת login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- רק admin יכול לראות את כל ניסיונות הכניסה
CREATE POLICY "Only admins can view login attempts" 
ON public.login_attempts FOR SELECT 
USING (public.has_role_or_higher('admin'::user_role));

-- המערכת יכולה להוסיף רשומות ניסיונות כניסה
CREATE POLICY "System can log login attempts" 
ON public.login_attempts FOR INSERT 
WITH CHECK (true);

-- יצירת פונקציה לבדיקת Rate Limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  user_email TEXT,
  user_ip INET DEFAULT NULL,
  max_attempts INTEGER DEFAULT 5,
  time_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_count INTEGER;
  ip_attempt_count INTEGER;
BEGIN
  -- בדיקת מספר ניסיונות לפי email
  SELECT COUNT(*) INTO attempt_count
  FROM public.login_attempts
  WHERE email = user_email
    AND success = false
    AND attempted_at > (now() - (time_window_minutes || ' minutes')::interval);
  
  -- בדיקת מספר ניסיונות לפי IP (אם סופק)
  IF user_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_attempt_count
    FROM public.login_attempts
    WHERE ip_address = user_ip
      AND success = false
      AND attempted_at > (now() - (time_window_minutes || ' minutes')::interval);
    
    -- חסימה אם יש יותר מדי ניסיונות מאותו IP
    IF ip_attempt_count >= (max_attempts * 2) THEN
      RETURN false;
    END IF;
  END IF;
  
  -- חסימה אם יש יותר מדי ניסיונות לאותו email
  RETURN attempt_count < max_attempts;
END;
$$;

-- פונקציה לרישום ניסיון כניסה
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  user_email TEXT,
  user_ip INET DEFAULT NULL,
  is_success BOOLEAN DEFAULT false,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, success, user_agent)
  VALUES (user_email, user_ip, is_success, user_agent_string);
  
  -- ניקוי רשומות ישנות (מעל 24 שעות)
  DELETE FROM public.login_attempts
  WHERE attempted_at < (now() - interval '24 hours');
END;
$$;
