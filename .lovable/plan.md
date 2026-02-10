
# תוכנית: שדרוג דף "רכש חכם" לדשבורד משימות רכש

## סקירה כללית
שדרוג הדף הקיים `/procurement` מתצוגת טבלה בסיסית לדשבורד רכש מלא עם טאבים, סריקת חוסרים אוטומטית, פעולות מהירות, ומגירת פרטים -- הכל ללא תלות ב-WhatsApp או n8n. התקשורת עם ספקים קורית מחוץ לאפליקציה.

---

## שלב 1: Edge Function חדשה -- `procurement-backfill-low-stock`

יצירת Edge Function שמקבלת `business_id`, `created_by`, ו-`default_requested_quantity`, סורקת את כל המוצרים של העסק, בודקת אם `quantity <= low_stock_threshold` (מטבלת `product_thresholds`), ויוצרת `procurement_requests` בסטטוס `draft` עבור מוצרים שאין להם בקשה פתוחה (draft/in_progress).

מחזירה JSON: `{ ok: true, created: 3, skipped: 7 }`

**קובץ**: `supabase/functions/procurement-backfill-low-stock/index.ts`

---

## שלב 2: עדכון סטטוסים ב-ProcurementStatusBadge

הוספת הסטטוסים החדשים למפת הצבעים:
- `in_progress` -- כחול, "בטיפול"
- `ordered_external` -- ירוק-כהה, "הוזמן חיצונית"
- `resolved_external` -- ירוק, "טופל"
- `recommended` -- כבר קיים

**קובץ**: `src/components/procurement/ProcurementStatusBadge.tsx`

---

## שלב 3: Hook חדש -- `useLowStockProducts`

Hook שמביא מוצרים עם join ל-`product_thresholds` ומסנן רק מוצרים שבהם `quantity <= low_stock_threshold`. גם בודק אם יש בקשה פתוחה (draft/in_progress) לכל מוצר.

שאילתה יעילה: שתי שאילתות מקבילות (מוצרים + בקשות פתוחות) ואז merge בצד הקליינט.

**קובץ**: `src/hooks/useLowStockProducts.tsx`

---

## שלב 4: עדכון Hook `useProcurementRequests`

- הוספת mutation `updateStatus` -- עדכון סטטוס בודד (in_progress, ordered_external, resolved_external, cancelled)
- הוספת mutation `updateNotes` -- עדכון הערות
- שינוי ברירת מחדל של הסינון ל-`draft` + `in_progress` (במקום `all`)
- הוספת חיפוש לפי שם מוצר (בצד הקליינט)

**קובץ**: `src/hooks/useProcurementRequests.tsx`

---

## שלב 5: שדרוג דף `Procurement.tsx`

שכתוב הדף עם המבנה הבא:

```text
+-----------------------------------------------+
| ShoppingCart icon  "רכש חכם"                   |
| "ניהול בקשות רכש והצעות מחיר"                  |
|                    [סרוק חוסרים ופתח בקשות]     |
+-----------------------------------------------+
| [חוסרים] | [בקשות רכש]                         |
+-----------------------------------------------+
|                                                 |
|  (תוכן הטאב הנוכחי)                            |
|                                                 |
+-----------------------------------------------+
```

### טאב "חוסרים":
- טבלה: שם מוצר, כמות נוכחית, סף, סטטוס בקשה
- עמודת "בקשה פתוחה": badge אם יש / "אין בקשה" אם אין
- מצב ריק: "אין חוסרים כרגע"

### טאב "בקשות רכש":
- סינון סטטוס (dropdown), חיפוש חופשי
- טבלה: מוצר, כמות, סטטוס (badge), עדכון אחרון, הערות (תצוגה מקדימה)
- פעולות מהירות בכל שורה (dropdown): התחל טיפול, הוזמן חיצונית, טופל, ביטול
- לחיצה על שורה פותחת מגירת פרטים
- מצב ריק: "אין בקשות רכש עדיין" עם CTA לסריקה

**קובץ**: `src/pages/Procurement.tsx`

---

## שלב 6: רכיב חדש -- `ProcurementDetailDrawer`

מגירה (Sheet) שנפתחת בתוך דף הרכש (לא ניווט לדף אחר):
- פרטי מוצר: שם, כמות, סף
- הערות (עריכה inline)
- רשימת הצעות מחיר (מ-`supplier_quotes`) עם כפתור "הוסף הצעה ידנית" (שימוש ב-`ManualQuoteDialog` הקיים)
- כפתור "סמן כהמלצה" ליד כל הצעה
- כפתורי פעולה: "הוזמן חיצונית", "טופל", "בטל"

**קובץ**: `src/components/procurement/ProcurementDetailDrawer.tsx`

---

## שלב 7: עדכון `supabase/config.toml`

הוספת הגדרה ל-Edge Function החדשה `procurement-backfill-low-stock` עם `verify_jwt = true` (פונקציה זו נקראת מהקליינט עם auth token, לא מ-webhook).

---

## סיכום קבצים שמשתנים

| קובץ | פעולה |
|---|---|
| `supabase/functions/procurement-backfill-low-stock/index.ts` | חדש |
| `src/hooks/useLowStockProducts.tsx` | חדש |
| `src/components/procurement/ProcurementDetailDrawer.tsx` | חדש |
| `src/pages/Procurement.tsx` | שכתוב |
| `src/hooks/useProcurementRequests.tsx` | עדכון |
| `src/components/procurement/ProcurementStatusBadge.tsx` | עדכון |
| `supabase/config.toml` | עדכון |

## מה לא משתנה
- לא נוצר דף חדש -- הכל בתוך `/procurement` הקיים
- לא משנים עיצוב/צבעים/פונטים
- לא משנים מבנה DB (הטבלאות קיימות)
- לא מוחקים את `/procurement/:id` -- הוא נשאר כמו שהוא
