

## תיקון כפילויות בפעילות אחרונה

### שורש הבעיה

נמצאו **שני טריגרים** על טבלת `products` שמפעילים את אותה פונקציה `log_product_activity()`:

| טריגר | סוג | פונקציה |
|--------|------|---------|
| `log_product_activity_trigger` | BEFORE (INSERT/UPDATE/DELETE) | `log_product_activity()` |
| `trigger_log_product_activity` | AFTER (INSERT/UPDATE/DELETE) | `log_product_activity()` |

כל שינוי במוצר מפעיל את שני הטריגרים, ולכן כל פעולה נרשמת **פעמיים** בטבלת `recent_activity`.

### הפתרון

מחיקת הטריגר הכפול `trigger_log_product_activity` (ה-AFTER trigger), והשארת רק `log_product_activity_trigger` (ה-BEFORE trigger).

בנוסף - ניקוי הרשומות הכפולות שכבר נמצאות בבסיס הנתונים.

### פירוט טכני

**מיגרציה חדשה** עם שני שלבים:

1. מחיקת הטריגר הכפול:
```sql
DROP TRIGGER IF EXISTS trigger_log_product_activity ON public.products;
```

2. ניקוי כפילויות קיימות:
```sql
DELETE FROM public.recent_activity
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.recent_activity
  GROUP BY business_id, action_type, title, timestamp, product_id, quantity_changed
);
```

### סיכום

| פריט | פירוט |
|------|-------|
| קובץ חדש | מיגרציית SQL |
| שינוי | מחיקת טריגר כפול + ניקוי כפילויות |
| השפעה | כל פעולה תופיע פעם אחת בלבד |
| ללא שינוי בקוד | אין שינוי בקבצי TypeScript/React |

