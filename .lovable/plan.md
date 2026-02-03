

## תיקון שגיאת עדכון מוצר - סוג פעולה לא תקין

### הבעיה שזוהתה

כאשר מעלים כמות במוצר (רכישה), הקוד מנסה לשמור ל-`inventory_actions` עם `action_type: 'purchase'`. 
אבל ה-check constraint במסד הנתונים מאפשר רק:
- `add`, `remove`, `adjust`, `sale`, `return`

לכן `'purchase'` נדחה והמערכת מציגה שגיאה.

### פתרון מומלץ

נעדכן את המסד נתונים להוסיף `'purchase'` לרשימת סוגי הפעולות המותרים. זה יאפשר לתעד רכישות עם מידע פיננסי מלא.

### פרטים טכניים

**שינוי ב-Database:**
```sql
ALTER TABLE inventory_actions 
DROP CONSTRAINT inventory_actions_action_type_check;

ALTER TABLE inventory_actions 
ADD CONSTRAINT inventory_actions_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'add'::text, 
  'remove'::text, 
  'adjust'::text, 
  'sale'::text, 
  'return'::text,
  'purchase'::text  -- הוספה
]));
```

**שינויים בקוד:** אין צורך - הקוד כבר משתמש ב-`'purchase'` נכון.

### סיכום

| פריט | פירוט |
|------|-------|
| קובץ | Database constraint |
| סוג שינוי | הוספת ערך לרשימת סוגי פעולות |
| סיבת השגיאה | `'purchase'` לא נמצא ב-check constraint |
| תיקון | הוספת `'purchase'` לרשימה המותרת |

