
# M4 — Supplier Invoices Storage Hardening

## מטרה
לסגור את הדליפה הפוטנציאלית בבאקט `supplier-invoices` בכך ש:
1. הבאקט יהפוך ל-**private**.
2. כל פעולה (SELECT/INSERT/DELETE) תידרש להיות ע"י **חבר מאושר של אותו עסק שהקובץ שייך לו** (לפי תיקיית root = `business_id`).
3. הקוד יעבור מ-`getPublicUrl` ל-**signed URLs** קצרי-מועד.

## היקף
- היקף מצומצם בלבד, בלי לגעת ב-business logic.
- לא נוגעים ב-M5/M6/M7/M8.
- ללא שינוי בעיצוב, כפתורים, או דפים.

## מצב נוכחי (אומת)
- בקאט: `public = true`
- 3 policies על `{public}` שבודקות רק `auth.uid() IS NOT NULL`
- נתיב קיים: `<business_id>/<timestamp>.<ext>` ✅ נוח לאכיפה
- 0 קבצים בבאקט → אפס סיכון רגרסיה
- טבלת `supplier_invoices` שומרת `file_url` כ-publicUrl (יוחלף ל-path בלבד או יומר ב-runtime ל-signed URL)

## תוכנית שינויים

### A. Migration — Storage
1. `UPDATE storage.buckets SET public = false WHERE id = 'supplier-invoices';`
2. `DROP` 3 ה-policies הקיימות.
3. `CREATE` 3 policies חדשות על `{authenticated}` בלבד, בכולן:
   - `bucket_id = 'supplier-invoices'`
   - **AND** המשתמש הוא owner של העסק או חבר מאושר (`user_businesses` עם `role` רלוונטי) שזיהויו תואם ל-`(storage.foldername(name))[1]::uuid`.

### B. שינוי קוד מינימלי ב-`useSupplierInvoices.tsx`
- `uploadFile`: לשמור ב-DB את ה-**path** (`<business_id>/<timestamp>.ext`) במקום publicUrl, או לחלופין להמשיך לשמור URL מלא אבל לייצר Signed URL בעת תצוגה/הורדה.
- בעת תצוגה/הורדה: `supabase.storage.from('supplier-invoices').createSignedUrl(path, 60)`.
- שום שינוי UI נראה למשתמש (קישור הורדה ממשיך לעבוד, פשוט נוצר on-demand).

### C. Smoke Tests אחרי המעבר
| תרחיש | מצופה |
|---|---|
| anon GET ל-publicUrl ישן | 400/403 (כי הבאקט private) |
| authenticated של עסק B מנסה SELECT על path של עסק A | חסום (RLS) |
| authenticated של עסק B מנסה DELETE על קובץ של עסק A | חסום (RLS) |
| member מאושר של עסק A — upload, list, signed URL, delete | ✅ עובד |
| owner של עסק A — אותו דבר | ✅ עובד |

## פרטים טכניים (לסקירה לפני הרצה)

### דוגמה ל-policy חדשה (SELECT)
```sql
CREATE POLICY "Members can read own business invoices"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id::text = (storage.foldername(name))[1]
      AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_businesses ub
    WHERE ub.business_id::text = (storage.foldername(name))[1]
      AND ub.user_id = auth.uid()
  )
);
```
(אותו עיקרון ל-INSERT עם `WITH CHECK` ול-DELETE עם `USING`.)

### שדה `file_url` בטבלה
שתי אופציות — מבקש החלטה:
- **(מועדף)** להפסיק לשמור publicUrl, לשמור רק path. בקריאה — לייצר Signed URL.
- (חלופי) להשאיר את ה-`file_url` כפי שהוא, ולחלץ ממנו path בעת תצוגה כדי לייצר Signed URL.

מאחר וברגע זה אין קבצים בכלל בבאקט (0 רשומות), אופציה (1) חלקה לחלוטין.

## מה לא נעשה במסגרת M4
- לא משנה policies על שום טבלה אחרת.
- לא משנה Edge Functions.
- לא נוגע ב-`brands` / `categories` / `stock_approval_requests` / `realtime` / dependencies.
- לא משדרג Postgres ולא מפעיל Leaked Password Protection.

## מה דרוש מהמשתמש
1. אישור התוכנית.
2. אישור לבחירת אופציה לאחסון (path בלבד מומלץ).
3. אחר כך אריץ את ה-migration ואת שינוי הקוד, ואדווח על תוצאות smoke tests.
