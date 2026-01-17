-- ===============================================
-- שלב 1: תיקון RLS Policies עם (true)
-- ===============================================

-- 1. audit_logs - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs 
FOR INSERT TO service_role WITH CHECK (true);

-- 2. login_attempts - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can log login attempts" ON public.login_attempts;
CREATE POLICY "Service role can log login attempts" ON public.login_attempts 
FOR INSERT TO service_role WITH CHECK (true);

-- 3. notifications - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications 
FOR INSERT TO service_role WITH CHECK (true);

-- 4. recent_activity - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can insert activities" ON public.recent_activity;
DROP POLICY IF EXISTS "System can insert recent activity" ON public.recent_activity;
CREATE POLICY "Service role can insert recent activity" ON public.recent_activity 
FOR INSERT TO service_role WITH CHECK (true);

-- 5. stock_alerts - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can insert stock alerts" ON public.stock_alerts;
CREATE POLICY "Service role can insert stock alerts" ON public.stock_alerts 
FOR INSERT TO service_role WITH CHECK (true);

-- 6. user_activity_log - הגבלה ל-service_role בלבד
DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_log;
CREATE POLICY "Service role can insert activity logs" ON public.user_activity_log 
FOR INSERT TO service_role WITH CHECK (true);

-- 7. stock_approval_requests - הגבלה לפי עסק של המשתמש
DROP POLICY IF EXISTS "System can insert stock approval requests" ON public.stock_approval_requests;
CREATE POLICY "Users can insert stock approval requests for their business" 
ON public.stock_approval_requests FOR INSERT TO authenticated
WITH CHECK (
  product_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.businesses b ON p.business_id = b.id
    WHERE p.id = stock_approval_requests.product_id
    AND (
      b.owner_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.business_users bu 
        WHERE bu.business_id = b.id 
        AND bu.user_id = auth.uid() 
        AND bu.status = 'approved'
      )
    )
  )
);

-- 8. stock_approvals - הגבלה לפי עסק (שימו לב: business_id הוא TEXT!)
DROP POLICY IF EXISTS "System can insert stock approvals" ON public.stock_approvals;
CREATE POLICY "Users can insert stock approvals for their business" 
ON public.stock_approvals FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = stock_approvals.business_id
    AND (
      b.owner_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.business_users bu 
        WHERE bu.business_id = b.id 
        AND bu.user_id = auth.uid() 
        AND bu.status = 'approved'
      )
    )
  )
);

-- 9. product_categories - הגבלה לפי business_category
DROP POLICY IF EXISTS "Users can create product categories" ON public.product_categories;
CREATE POLICY "Users can create product categories for their business" 
ON public.product_categories FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_categories bc
    JOIN public.businesses b ON b.business_category_id = bc.id
    WHERE bc.id = product_categories.business_category_id
    AND (
      b.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.business_users bu 
        WHERE bu.business_id = b.id 
        AND bu.user_id = auth.uid() 
        AND bu.status = 'approved'
      )
    )
  )
);