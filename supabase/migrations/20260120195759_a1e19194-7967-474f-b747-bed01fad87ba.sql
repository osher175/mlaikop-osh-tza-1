-- שלב 5: הקשחת notification_settings ו-product_thresholds
-- שימוש בפונקציה הקיימת has_role_or_higher במקום has_role

-- ========== notification_settings ==========
-- מחיקת ה-policy הקיים (אם קיים)
DROP POLICY IF EXISTS "Users can manage notification settings for their business" ON public.notification_settings;

-- SELECT: Admin מערכת, Owner עסק, או עובד מאושר
CREATE POLICY "ns_select_policy"
ON public.notification_settings
FOR SELECT
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND status = 'approved')
);

-- INSERT: Admin מערכת או Owner עסק בלבד
CREATE POLICY "ns_insert_policy"
ON public.notification_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- UPDATE: Admin מערכת או Owner עסק בלבד
CREATE POLICY "ns_update_policy"
ON public.notification_settings
FOR UPDATE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- DELETE: Admin מערכת או Owner עסק בלבד
CREATE POLICY "ns_delete_policy"
ON public.notification_settings
FOR DELETE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- ========== product_thresholds ==========
-- מחיקת ה-policy הקיים (אם קיים)
DROP POLICY IF EXISTS "Users can manage product thresholds for their business" ON public.product_thresholds;

-- SELECT: Admin מערכת, Owner עסק, או עובד מאושר
CREATE POLICY "pt_select_policy"
ON public.product_thresholds
FOR SELECT
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM public.business_users WHERE user_id = auth.uid() AND status = 'approved')
);

-- INSERT: Admin מערכת או Owner עסק בלבד
CREATE POLICY "pt_insert_policy"
ON public.product_thresholds
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- UPDATE: Admin מערכת או Owner עסק בלבד
CREATE POLICY "pt_update_policy"
ON public.product_thresholds
FOR UPDATE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- DELETE: Admin מערכת או Owner עסק בלבד
CREATE POLICY "pt_delete_policy"
ON public.product_thresholds
FOR DELETE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);