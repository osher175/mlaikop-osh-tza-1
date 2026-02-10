
# תיקון: תוצאות ריקות בטאב "בקשות רכש"

## הבעיה
יש 424 בקשות רכש בבסיס הנתונים (404 בסטטוס draft, 20 ב-waiting_for_quotes), אבל הטבלה מציגה "אין בקשות רכש עדיין".

שתי סיבות:

1. **שדה החיפוש מכיל "2355018"** -- זה נראה כמו ברקוד, אבל החיפוש מסנן רק לפי **שם מוצר**. אף שם מוצר לא מכיל את המחרוזת הזו, אז הכל מסונן החוצה.
2. **החיפוש לא תומך בברקוד** -- משתמשים מצפים שחיפוש מספר ברקוד ימצא את המוצר.

## הפתרון

### שינוי 1: הרחבת החיפוש לכלול גם ברקוד
בקובץ `src/hooks/useProcurementRequests.tsx`, שורה 97-98:

שינוי הפילטר מ:
```typescript
requests.filter(r => (r.products?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
```
ל:
```typescript
requests.filter(r => {
  const term = searchTerm.toLowerCase();
  const name = (r.products?.name ?? '').toLowerCase();
  const barcode = (r.products?.barcode ?? '').toLowerCase();
  return name.includes(term) || barcode.includes(term);
})
```

### שינוי 2: עדכון placeholder בשדה החיפוש
בקובץ `src/pages/Procurement.tsx`, שורה 194:

שינוי מ:
```
חיפוש לפי שם מוצר...
```
ל:
```
חיפוש לפי שם מוצר או ברקוד...
```

זהו -- שני שינויים קטנים. לא נוגעים בעיצוב, לא מוסיפים/מוחקים דפים, לא משנים DB.
