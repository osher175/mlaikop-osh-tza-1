-- שלב 3: הקשחת notifications RLS

-- מחיקת policies ישנים
DROP POLICY IF EXISTS "Users can view notifications for their business" ON public.notifications;
DROP POLICY IF EXISTS "Users can update notifications for their business" ON public.notifications;

-- Policy חדש ל-SELECT: משתמש רואה התראות שלו או של העסק שהוא owner/admin בו
CREATE POLICY "Users can view own or business notifications"
ON public.notifications 
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  public.has_role_or_higher('admin'::user_role)
  OR
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Policy חדש ל-UPDATE
CREATE POLICY "Users can update own notifications"
ON public.notifications 
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  public.has_role_or_higher('admin'::user_role)
  OR
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR
  public.has_role_or_higher('admin'::user_role)
  OR
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);