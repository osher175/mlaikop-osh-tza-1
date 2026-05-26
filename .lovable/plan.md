
## מצב נוכחי של שורת הבדיקה

**`session_id`: `11111111-2222-3333-4444-555555555555`**

| בדיקה | מצב | פעולה נדרשת |
|---|---|---|
| 1. מסומן `is_test=true` | חלקית — רק ב-`metadata.is_test` | להחזק תיוג ולחזק אותו |
| 2. לא נספר באנליטיקות | ✅ אין צרכן אנליטי של `payment_sessions` בקוד או ב-RPCs | להוסיף הגנה הצהרתית למקרה עתידי |
| 3. לא משפיע על מנוי עסק אמיתי | ✅ `user_subscriptions` של העסק נשאר `status='trial'`. אין trigger/RPC שממיר `payment_sessions.paid` למנוי | להוסיף הגנה הצהרתית למקרה עתידי |
| 4. דרך מחיקה נקייה | ❌ אין | להוסיף RPC ייעודי |

הסיבה ל"חלקית" ב-(1): השורה מקושרת ל-`business_id` של עסק אמיתי (M2 Biz A, owner db40d81c…). זה לא בעיה היום, אבל ברגע שתחבר webhook→`user_subscriptions`, השורה הזו תוכל בטעות לסמן עסק אמיתי כמשולם.

## תוכנית — 3 שינויי DB בלבד, אפס שינויי קוד/UI

### 1. תיוג ברור גם על העמודה הראשית
- להוסיף `is_test boolean NOT NULL DEFAULT false` ל-`payment_sessions`.
- לעדכן את שורת הבדיקה: `is_test=true`.
- (לשמור גם את `metadata.is_test` לתאימות).

### 2. הגנת "test-aware" לכל future consumer
- להוסיף **VIEW** `payment_sessions_live` שמסנן `WHERE is_test=false`.
- מוסכמה: כל לוגיקה עתידית שמפעילה מנוי/אנליטיקה תקרא מ-`payment_sessions_live`, לא מהטבלה הגולמית.
- באותה צורה: `billing_events_live` שמסנן `WHERE (metadata->>'is_test')::boolean IS NOT TRUE`.
- ב-edge function `grow-create-subscription` (היום) — לא משנים כלום; הוא יוצר session אמיתי עם `is_test=false` (ברירת מחדל החדשה).

### 3. דרך מחיקה נקייה
- RPC `delete_test_payment_session(p_session_id uuid)`:
  - `SECURITY DEFINER`, `SET search_path = public`
  - מוגנת ב-`has_role_or_higher('admin')`
  - מוחקת מ-`billing_events` כל שורה שב-`metadata->>'session_id' = p_session_id::text`, ואז מוחקת את ה-`payment_sessions` עצמה
  - מוודאת `is_test=true` לפני מחיקה — אחרת זורקת exception ("refuse to delete non-test session")
- שימוש עתידי: `select public.delete_test_payment_session('11111111-…555');` ינקה את השורה + 3 ה-billing_events שלה באטומיות.

## מה לא ייעשה
- לא נוגעים ב-RLS/הרשאות קיימים.
- לא משנים את ה-edge functions, את ה-UI, או את ה-Subscribe flow.
- לא מוחקים את שורת הבדיקה.
- לא נוגעים בעסק האמיתי או ב-`user_subscriptions`.

## פרטים טכניים (למפתח)

```sql
-- 1. עמודה + עדכון השורה הקיימת
ALTER TABLE public.payment_sessions
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
UPDATE public.payment_sessions
  SET is_test = true
  WHERE id = '11111111-2222-3333-4444-555555555555';
CREATE INDEX IF NOT EXISTS idx_payment_sessions_is_test
  ON public.payment_sessions(is_test) WHERE is_test = false;

-- 2. Views להגנה עתידית
CREATE OR REPLACE VIEW public.payment_sessions_live AS
  SELECT * FROM public.payment_sessions WHERE is_test = false;
CREATE OR REPLACE VIEW public.billing_events_live AS
  SELECT * FROM public.billing_events
  WHERE COALESCE((metadata->>'is_test')::boolean, false) = false;

-- 3. RPC ייעודי למחיקה בטוחה
CREATE OR REPLACE FUNCTION public.delete_test_payment_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_is_test boolean;
BEGIN
  IF NOT has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT is_test INTO v_is_test FROM payment_sessions WHERE id = p_session_id;
  IF v_is_test IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'refuse to delete non-test session %', p_session_id;
  END IF;
  DELETE FROM billing_events WHERE metadata->>'session_id' = p_session_id::text;
  DELETE FROM payment_sessions WHERE id = p_session_id AND is_test = true;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_test_payment_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_payment_session(uuid) TO authenticated;
```

אישור → אפעיל כמיגרציה אחת. השורה נשארת במקום.
