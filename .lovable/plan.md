

## תיקון: פילוח רכישות לפי ספקים - נתונים לא מוצגים

### שורש הבעיה

כשיוצרים מוצר חדש דרך טופס "הוסף מוצר", הפונקציה `logInventoryAction` רושמת פעולת `add` בטבלת `inventory_actions` **בלי נתונים פיננסיים** (ללא `purchase_unit_ils`, `purchase_total_ils`, `supplier_id`).

הגרף של "פילוח רכישות לפי ספקים" מסנן רק רשומות עם `purchase_total_ils != null`, ולכן מוצרים חדשים לא מופיעים.

### הפתרון

שני שינויים:

**1. עדכון `useInventoryLogger.tsx`** - הרחבת הפונקציה `logInventoryAction` כדי לקבל נתונים פיננסיים אופציונליים:
- `purchase_unit_ils` - עלות ליחידה
- `purchase_total_ils` - עלות כוללת
- `supplier_id` - מזהה ספק

**2. עדכון `useProducts.tsx`** - בעת יצירת מוצר חדש עם כמות התחלתית, להעביר את נתוני העלות והספק ל-`logInventoryAction`:
- אם יש `cost` למוצר, להשתמש בו כ-`purchase_unit_ils`
- לחשב `purchase_total_ils = cost * quantity`
- להעביר את `supplier_id` אם קיים

### פירוט טכני

```text
logInventoryAction(productId, 'add', quantity, notes)
                        |
                        v  (לפני התיקון - בלי נתונים פיננסיים)
inventory_actions: { action_type: 'add', quantity_changed: 5, purchase_total_ils: NULL }
                        |
                        v  (אחרי התיקון - עם נתונים פיננסיים)
inventory_actions: { action_type: 'add', quantity_changed: 5, purchase_unit_ils: 10, purchase_total_ils: 50, supplier_id: '...' }
```

### קבצים שישתנו

| קובץ | שינוי |
|------|-------|
| `src/hooks/useInventoryLogger.tsx` | הוספת פרמטרים פיננסיים אופציונליים לפונקציה |
| `src/hooks/useProducts.tsx` | העברת cost ו-supplier_id בעת יצירת מוצר חדש |

### מה לא ישתנה
- אין שינוי בעיצוב או בממשק המשתמש
- אין שינוי בבסיס הנתונים
- אין שינוי בקומפוננטת `SuppliersChart`

### הערה חשובה
רשומות ישנות שנוצרו בלי נתונים פיננסיים עדיין לא יופיעו בגרף. התיקון ישפיע רק על מוצרים חדשים שנוצרים מעכשיו.

