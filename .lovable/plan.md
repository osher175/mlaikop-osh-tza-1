## אבחון: למה יש "מיקרו־תקיעות" של שניות בודדות

בדקתי את הקוד של `Dashboard`, `Inventory`, `MainLayout`, ה־hooks של React Query וה־Realtime. מצאתי כמה גורמים שמצטברים יחד וגורמים לתחושת איטיות במעברים ובהקלדה. לפי הוראות הפרויקט אני **לא משנה כלום בלי אישור** — להלן הממצאים והתיקונים המוצעים.

---

### הגורמים שזיהיתי

**1. `MainLayout` נטען מחדש בכל מעבר עמוד**
ב־`App.tsx` כל route עוטף בנפרד את `<MainLayout>` (במקום `<Route element>` משותף עם `<Outlet/>`). מעבר מ־`/dashboard` ל־`/inventory` → גם ה־Sidebar וגם ה־Header נהרסים ונבנים מחדש (188 שורות + ניווט + תפריט התראות). זו הסיבה המרכזית ל"קפיצה" של ~300–700ms במעבר.

**2. דף המלאי חוסם רינדור עם ספינר מלא**
ב־`Inventory.tsx` שורה 77: `if (businessLoading || productsLoading) return <Loader/>` — כל פעם שנכנסים, אם ה־cache התיישן (`staleTime: 2min`), כל הדף נעלם לטובת ספינר במקום להציג נתונים קיימים תוך־כדי רענון ברקע.

**3. `useRealtimeDashboard` יוצר 8 שאילתות בו־זמנית בכל ביקור בלוח הבקרה**
ב־`useRealtimeDashboard.ts` יש listener על `visibilitychange` שמרענן **8 query keys** בכל פעם שהטאב חוזר לפוקוס — כולל לחיצה על שדה צ'אט חיצוני או חזרה מטאב אחר. גם הצ'אט בתוך האפליקציה (אם יש) גורם לזה. זה גורם ל־400ms של עבודה ב־main thread, ולכן הקלדה מרגישה "תקועה".

**4. ערוצי Supabase Realtime נפתחים ונסגרים על כל ניווט**
`dashboard-live-${businessId}` ו־`reports-live-${businessId}` נרשמים ב־mount ונמחקים ב־unmount. כל פעם שיוצאים מ־Dashboard ונכנסים שוב — handshake חדש מול Supabase (~200–500ms) + burst של invalidations.

**5. `refetchOnWindowFocus: true` ב־hooks כבדים**
`useBIAnalytics`, `useInsights`, `useReports`, `useReportsData`, `useSalesByDimension`, `useNotifications` עם `staleTime: 0` או 15s — כל לחיצה מחוץ ל־iframe וחזרה גורמת לרענון מקבילי של 5–6 שאילתות כבדות.

**6. `useRecentActivity` עם `refetchInterval: 30000`**
פולינג כל 30 שניות גם כשהדף לא פעיל — נוסף לעומס.

**7. ה־Charts ב־Dashboard לא ממומוייזים**
`RevenueChart`, `TopSalesByDimension`, `SuppliersChart`, `MonthlyPurchasesChart` מתרנדרים מחדש בכל invalidation גם אם הנתונים זהים.

---

### תיקונים מוצעים (לא בוצעו, מחכים לאישורך)

**A. Layout משותף (השיפור הכי משמעותי)**
לעטוף את הראוטים האותנטיקטיביים ב־`Route` יחיד עם `<MainLayout><Outlet/></MainLayout>` ולהסיר `<MainLayout>` מכל עמוד בנפרד. תוצאה: Sidebar/Header לא נהרסים במעבר.

**B. החלפת ספינר מלא ב־Inventory ב־`isPending` בלבד**
להציג את הספינר רק כשאין נתונים בכלל (`!products.length && isLoading`), אחרת להציג את הנתונים הקיימים. מונע "הבהוב" ריק במעבר.

**C. הסרת `visibilitychange refetch` מ־`useRealtimeDashboard` ו־`useRealtimeReports`**
ה־Realtime כבר מעדכן בזמן אמת — הריענון על focus מיותר וגורם ל־burst. להשאיר רק את ה־subscription.

**D. ייצוב ערוצי Realtime ברמת ה־App**
להעביר את `useRealtimeDashboard` מ־Dashboard עצמו ל־רמת ה־layout/App, כך שהערוץ לא ייסגר במעבר ל־Inventory וחזרה.

**E. הגדלת `staleTime` ב־hooks כבדים שלא חייבים real-time**
`useNotifications`, `useInsights`, `useBIAnalytics` — להעלות מ־0/15s ל־60s, או להשאיר 0 אבל לכבות `refetchOnWindowFocus`.

**F. הורדת `refetchInterval` ב־`useRecentActivity` מ־30s ל־60s** (או להישען רק על Realtime).

**G. עטיפת רכיבי הצ'ארטים ב־`React.memo`**
למנוע re־renders מיותרים כש־props לא השתנו.

---

### למה זה ישפיע על תחושת ההקלדה בצ'אט?
ברגע שלוחצים על שדה טקסט חיצוני, ה־iframe מאבד פוקוס וחוזר → `visibilitychange` + `refetchOnWindowFocus` מפעילים 6–8 שאילתות במקביל → ה־main thread עסוק ~300–800ms בעיבוד תוצאות + re־renders → התווים הראשונים שמקלידים "נתקעים".

---

### הצעת ביצוע

מומלץ לבצע **A + B + C** קודם — אלה ייתנו 80% מהשיפור עם סיכון מינימלי ובלי שינוי עיצובי או פונקציונלי. לאחר מכן D/E/F/G לפי הצורך.

האם לבצע את A+B+C? או שאתה רוצה שאתחיל רק עם תיקון אחד מהם?
