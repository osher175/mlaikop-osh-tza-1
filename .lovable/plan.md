

## תיקון בעיות דוחות והוספת דירוג 20 מוצרים פופולריים

### סיכום הבעיות שזוהו

#### בעיה 1: פילוח רכישות לפי ספקים לא מציג נתונים
**סיבה:** שגיאת SQL בפונקציית `reports_aggregate` - שימוש לא תקין ב-`jsonb_agg` עם `SUM` בתוכו גורם לשגיאה "aggregate function calls cannot be nested". השגיאה נתפסת בשקט ומוחזר מערך ריק.

**פתרון:** תיקון השאילתה להשתמש ב-subquery:
```sql
-- מעבר מ:
SELECT jsonb_agg(jsonb_build_object(..., SUM(quantity)))
GROUP BY ...

-- ל:
SELECT jsonb_agg(t) FROM (
  SELECT ... SUM(quantity) ... GROUP BY ...
) t
```

#### בעיה 2: רכישות חודשיות לא מציגות נתונים
**סיבה:** אותה בעיה - הקוד מסתמך על `purchase_total_ils` שהוא NULL ב-100% מהרשומות.

**פתרון:** שינוי הקריטריון לספירה לפי `quantity_changed` במקום `purchase_total_ils`.

---

### דרישה חדשה: דירוג 20 מוצרים פופולריים

**מה יתווסף:**
- קומפוננטה חדשה `TopProductsRanking` שתציג דירוג 1-20 של מוצרים
- סינון לפי טווח זמן: שבוע / חודש / שנה
- כמות מדויקת שנמכרה מכל מוצר
- עיצוב טבלאי עם דירוג ויזואלי

---

### פירוט טכני

#### 1. עדכון פונקציית Database: `reports_aggregate`

**שינויים:**
- תיקון `suppliers_breakdown` עם subquery
- הוספת שדה חדש `top_products_list` שיחזיר מערך של 20 מוצרים

```sql
-- Suppliers breakdown (תיקון)
SELECT jsonb_agg(t) INTO suppliers_breakdown
FROM (
  SELECT 
    s.id as supplier_id,
    COALESCE(s.name, 'ללא ספק') as supplier_name,
    SUM(ia.quantity_changed) as total_purchased
  FROM inventory_actions ia
  LEFT JOIN products p ON p.id = ia.product_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to
  GROUP BY s.id, s.name
  ORDER BY SUM(ia.quantity_changed) DESC
) t;

-- Top 20 products (חדש)
SELECT jsonb_agg(t) INTO top_products_list
FROM (
  SELECT 
    p.id as product_id,
    p.name as product_name,
    SUM(ABS(ia.quantity_changed)) as quantity_sold,
    COALESCE(SUM(ia.sale_total_ils), 0) as revenue
  FROM inventory_actions ia
  JOIN products p ON p.id = ia.product_id
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to
  GROUP BY p.id, p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 20
) t;
```

#### 2. עדכון TypeScript types

**קובץ:** `src/types/reports.ts`

```typescript
export interface ReportsData {
  // ... קיים
  top_products_list: Array<{
    product_id: string;
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}
```

#### 3. קומפוננטה חדשה: `TopProductsRanking`

**קובץ:** `src/components/reports/TopProductsRanking.tsx`

**תכונות:**
- טבלה עם 20 שורות מדורגות
- עמודות: דירוג | שם מוצר | כמות נמכרה | הכנסות
- עיצוב עם מדליות לשלושה הראשונים (זהב, כסף, ארד)
- סינון טווח זמן מובנה (שבוע/חודש/שנה)

#### 4. עדכון דף הדוחות

**קובץ:** `src/pages/Reports.tsx`

**שינויים:**
- החלפת הכרטיס הפשוט "המוצר הפופולרי ביותר" בקומפוננטת `TopProductsRanking`
- העברת ה-props הנדרשים

---

### סיכום השינויים

| קובץ/רכיב | שינוי |
|-----------|-------|
| `reports_aggregate` (DB) | תיקון suppliers_breakdown + הוספת top_products_list |
| `src/types/reports.ts` | הוספת interface עבור top_products_list |
| `src/components/reports/TopProductsRanking.tsx` | קומפוננטה חדשה - דירוג 20 מוצרים |
| `src/pages/Reports.tsx` | שילוב הקומפוננטה החדשה במקום הכרטיס הפשוט |

---

### דוגמה ויזואלית

```text
+-----+------------------+-----------+---------+
| #   | מוצר             | כמות      | הכנסות  |
+-----+------------------+-----------+---------+
| 🥇1 | 2254517 פרונוויי | 93 יחידות | ₪4,592  |
| 🥈2 | צמיג 205/55R16   | 87 יחידות | ₪3,900  |
| 🥉3 | מסנן שמן         | 65 יחידות | ₪2,150  |
| 4   | ...              | ...       | ...     |
+-----+------------------+-----------+---------+
```

