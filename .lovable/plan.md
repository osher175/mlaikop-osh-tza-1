## הבעיה

לחיצה על "בטל" ב-Undo Banner נכשלת עם השגיאה:
`type "app_role" does not exist`

## שורש הבעיה (מאומת)

הפונקציה `public.reverse_inventory_action` (מיגרציה `20260719122212`) משתמשת ב:
```sql
SELECT public.has_role(v_user, 'admin'::app_role) INTO v_is_admin;
```

אבל בפרויקט הזה:
- אין enum בשם `app_role` — ה-enum הקיים הוא `public.user_role`
- אין פונקציה `has_role(uuid, app_role)` — הפונקציה הקיימת היא `has_role_or_higher(user_role)`

לכן ה-RPC נכשל בכל ריצה עבור כל משתמש, ולא רק בבדיקת ההרשאה.

## התיקון

מיגרציה יחידה שמחליפה את בדיקת ה-admin ב-`reverse_inventory_action` לשימוש בכלים הקיימים בפרויקט:

```sql
CREATE OR REPLACE FUNCTION public.reverse_inventory_action(p_action_id UUID)
-- ... זהה לקיים, למעט השורה של v_is_admin:
v_is_admin := public.has_role_or_higher('admin'::user_role, v_user);
```

שאר הלוגיקה (חלון 10 דקות, בדיקת reversal קיים, שחזור מלאי, רישום reversal row, סימון reversed_at) נשארת ללא שינוי.

## היקף השינוי

- מיגרציה אחת שמעדכנת רק את `reverse_inventory_action`.
- אין שינוי ב-frontend, אין שינוי בסכימה, אין שינוי בפונקציות אחרות.
- אין נגיעה בקבצי Billing / Subscription (Code Freeze נשמר).

## אימות לאחר הרצה

לאחר אישור המיגרציה: לבצע מכירה/הורדה בטבלת המלאי, ללחוץ "בטל" בבאנר, ולוודא שהמלאי משוחזר ושמופיע toast "הפעולה בוטלה".
