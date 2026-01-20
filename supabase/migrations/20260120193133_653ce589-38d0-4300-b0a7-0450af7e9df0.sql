-- שלב 4: הקשחת audit_logs ו-user_activity_log

-- ========== audit_logs ==========
-- מחיקת ה-INSERT policy הקיים (פתוח מדי)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

-- יצירת INSERT policy מוגבל ל-service_role בלבד
-- הערה: לא ניתן להגביל ל-service_role ישירות ב-RLS, אז נשתמש בבדיקה של auth.role()
CREATE POLICY "Only service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- ========== user_activity_log ==========
-- מחיקת ה-INSERT policy הקיים (פתוח מדי)
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.user_activity_log;

-- יצירת INSERT policy מוגבל
CREATE POLICY "Only service role can insert activity logs"
ON public.user_activity_log
FOR INSERT
TO authenticated, anon
WITH CHECK (false);