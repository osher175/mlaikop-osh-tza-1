
אבחון ממוקד (למה זה לא מתעדכן):
1) ב-`src/hooks/useReports.tsx` טווח הזמן (במיוחד `date_to`) מחושב פעם אחת לכל בחירת פילטר ונשאר “קפוא”. לכן גם אם נכנסות עסקאות חדשות — הקריאה נשארת עם סוף טווח ישן.
2) דף `/reports` לא מחובר בכלל ל-Realtime (בניגוד לדשבורד), ולכן אין invalidate אוטומטי לנתונים.
3) `TopProductsRanking` גם עובד עם cache יחסית ארוך וללא invalidation יזום.
4) בכרטיס “סה״כ יצאו” יש class צבע שעלול להסתיר את המספר (`text-accent-foreground`), מה שיוצר תחושה שזה לא מתעדכן.

תוכנית יישום קצרה:
שלב 1 — תיקון לוגיקת טווח זמן בדוחות  
- קובץ: `src/hooks/useReports.tsx`  
- להעביר חישוב `date_from/date_to` לתוך `queryFn` בכל fetch (ולא לשמור `date_to` קבוע).  
- לייצב `queryKey` ל-`['reports_aggregate', businessId, range]`.  
- לכוון cache לרענון אמין: `staleTime` קצר יותר + `refetchOnWindowFocus: true`.

שלב 2 — Realtime לדף Reports  
- קובץ חדש: `src/hooks/useRealtimeReports.ts`  
- האזנה ל-`inventory_actions` ו-`products` לפי `business_id` עם debounce קטן.  
- על כל שינוי: `invalidateQueries` ל-`reports_aggregate` ול-`top_products_ranking` (ובמידת הצורך גם ל-`insights` של דף הדוחות).  
- שילוב hook בדף `src/pages/Reports.tsx`.

שלב 3 — רענון טבלת דירוג מוצרים  
- קובץ: `src/components/reports/TopProductsRanking.tsx`  
- לוודא שהשאילתה מתרעננת עם invalidation מה-Realtime וש-cache לא חונק עדכונים.  
- לשמור את הסינונים (שנה/חודש/שבוע) כפי שהם, בלי שינוי UX.

שלב 4 — תיקון תצוגת ערך “סה״כ יצאו”  
- קובץ: `src/pages/Reports.tsx`  
- להחליף רק את class הצבע של הערך כך שהמספר תמיד ייראה (ללא שינוי עיצובי רחב).

שלב 5 — בדיקות קבלה  
- לבצע פעולה של קנייה/מכירה ולוודא שב-`/reports` הכרטיסים, הגרפים והדירוג מתעדכנים תוך ~1–2 שניות.  
- לעבור בין יומי/שבועי/חודשי/שנתי ולוודא שהערכים (כולל רווח נטו) משתנים נכון.  
- לוודא במובייל וטאבלט שהערכים מוצגים ומתעדכנים תקין.
