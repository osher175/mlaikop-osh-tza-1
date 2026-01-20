-- ========================================
-- שלב 4: Views מסוננים ללוגים (מסתיר IP, user_agent, details)
-- ========================================

-- View מסונן ל-audit_logs - מסתיר מידע רגיש
CREATE OR REPLACE VIEW public.audit_logs_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  business_id,
  user_id,
  action_type,
  target_type,
  target_id,
  -- מסתיר details - מציג רק שהיה שינוי
  CASE WHEN details IS NOT NULL THEN '{"hidden": true}'::jsonb ELSE NULL END as details,
  -- מסתיר IP ו-user_agent
  NULL::inet as ip_address,
  NULL::text as user_agent,
  timestamp,
  created_at
FROM public.audit_logs;

-- View מסונן ל-user_activity_log - מסתיר IP, user_agent, old_values, new_values
CREATE OR REPLACE VIEW public.user_activity_log_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  business_id,
  action_type,
  entity_type,
  entity_id,
  entity_name,
  -- מסתיר old_values ו-new_values
  CASE WHEN old_values IS NOT NULL THEN '{"hidden": true}'::jsonb ELSE NULL END as old_values,
  CASE WHEN new_values IS NOT NULL THEN '{"hidden": true}'::jsonb ELSE NULL END as new_values,
  -- מסתיר IP ו-user_agent
  NULL::inet as ip_address,
  NULL::text as user_agent,
  timestamp,
  created_at
FROM public.user_activity_log;

-- ========================================
-- שלב 5: View מסונן לספקים (מסתיר phone ו-email מעובדים רגילים)
-- ========================================

CREATE OR REPLACE VIEW public.suppliers_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  business_id,
  name,
  agent_name,
  sales_agent_name,
  -- phone ו-email מוצגים רק לבעל העסק או admin
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN phone
    ELSE '***-*******'::text
  END as phone,
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN sales_agent_phone
    ELSE '***-*******'::text
  END as sales_agent_phone,
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN contact_email
    ELSE '***@***.***'::text
  END as contact_email,
  created_at,
  updated_at
FROM public.suppliers;

-- ========================================
-- שלב 6: View מסונן ל-WhatsApp logs (masking למספרי טלפון)
-- ========================================

CREATE OR REPLACE VIEW public.whatsapp_notifications_log_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  business_id,
  product_id,
  supplier_id,
  trigger_type,
  -- masking לטלפון - מציג רק 4 ספרות אחרונות
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN recipient_phone
    ELSE '***-***-' || RIGHT(COALESCE(recipient_phone, ''), 4)
  END as recipient_phone,
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN sales_agent_phone
    ELSE '***-***-' || RIGHT(COALESCE(sales_agent_phone, ''), 4)
  END as sales_agent_phone,
  -- masking להודעה - מסתיר תוכן רגיש
  CASE 
    WHEN public.has_role_or_higher('admin'::user_role) 
         OR business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid())
    THEN message_text
    ELSE '[תוכן מוסתר]'::text
  END as message_text,
  was_sent,
  sent_at,
  created_at,
  updated_at
FROM public.whatsapp_notifications_log;

-- ========================================
-- הגבלת SELECT על טבלאות גולמיות (רק owner/admin)
-- ========================================

-- suppliers - הגבלת SELECT על הטבלה הגולמית לבעלים בלבד
DROP POLICY IF EXISTS "Users can manage suppliers in their business" ON public.suppliers;

-- SELECT: רק בעל עסק או admin יכול לראות את הטבלה הגולמית (עובדים ישתמשו ב-View)
CREATE POLICY "suppliers_select_owner_admin"
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- INSERT/UPDATE/DELETE: רק בעל עסק או admin
CREATE POLICY "suppliers_insert_owner_admin"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "suppliers_update_owner_admin"
ON public.suppliers
FOR UPDATE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "suppliers_delete_owner_admin"
ON public.suppliers
FOR DELETE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- whatsapp_notifications_log - עדכון policies
DROP POLICY IF EXISTS "Users can manage whatsapp notifications for their business" ON public.whatsapp_notifications_log;

-- SELECT: רק בעל עסק או admin (עובדים ישתמשו ב-View המסונן)
CREATE POLICY "whatsapp_select_owner_admin"
ON public.whatsapp_notifications_log
FOR SELECT
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- INSERT: בעל עסק או admin
CREATE POLICY "whatsapp_insert_owner_admin"
ON public.whatsapp_notifications_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- UPDATE: בעל עסק או admin
CREATE POLICY "whatsapp_update_owner_admin"
ON public.whatsapp_notifications_log
FOR UPDATE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- DELETE: בעל עסק או admin
CREATE POLICY "whatsapp_delete_owner_admin"
ON public.whatsapp_notifications_log
FOR DELETE
TO authenticated
USING (
  public.has_role_or_higher('admin'::user_role)
  OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);