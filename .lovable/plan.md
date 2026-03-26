

## תוכנית: דשבורד חי עם סינון תקופתי

### מצב נוכחי — הלוגיקה תקינה

הלוגיקה הפיננסית ב-`useBIAnalytics` תקינה:
- מכירות נספרות מ-`remove` + `sale`
- רכישות מ-`add` + `purchase`
- חישוב רווח נטו = הכנסות/1.18 - COGS
- Top products ממוינים לפי הכנסות

**הבעיה**: הנתונים לא מתעדכנים בזמן אמת, וטבלת המוצרים המובילים מציגה רק שנה שלמה ללא אפשרות סינון לפי שבוע/חודש.

---

### שלב 1: Real-Time Hook מרכזי

**קובץ חדש: `src/hooks/useRealtimeDashboard.ts`**

Hook שמאזין בזמן אמת לטבלאות `inventory_actions` ו-`products` דרך Supabase Realtime. כשמגיע שינוי — invalidates את כל ה-query keys של הדשבורד:
- `bi-analytics-real` (גרפים + מוצרים מובילים)
- `summary-stats` (כרטיסיות סיכום)
- `insights` (תובנות חכמות)
- `notifications`
- `recent-activity`

כולל debounce של 500ms למניעת עדכונים מרובים ברצף.

### שלב 2: שילוב ב-Dashboard

**`src/pages/Dashboard.tsx`** — שורה אחת: `useRealtimeDashboard()`

### שלב 3: הורדת staleTime בכל ה-hooks

| Hook | staleTime נוכחי | staleTime חדש |
|------|----------------|---------------|
| `getSummaryStats.ts` | 60s | 15s |
| `useInsights.ts` | 5 דקות | 30s |
| `useBIAnalytics.tsx` | 2 דקות | 30s |
| `useNotifications.tsx` | 30s | 15s |

גם הפעלת `refetchOnWindowFocus: true` בכל מי שחסר.

### שלב 4: סינון תקופתי ב-TopProductsChart

**`src/components/dashboard/TopProductsChart.tsx`**

הוספת כפתורי סינון: **שבוע / חודש / שנה**

- ברירת מחדל: שנה (כמו היום)
- שבוע: 7 ימים אחרונים
- חודש: 30 ימים אחרונים
- שנה: מתחילת השנה הפיננסית

הסינון יתבצע client-side מתוך הנתונים שכבר נשלפו ב-`useBIAnalytics` (שכבר מביא את כל הפעולות של השנה). ה-hook יחזיר את ה-`financialActions` הגולמיים, וה-TopProductsChart יסנן לפי התקופה שנבחרה.

**`src/hooks/useBIAnalytics.tsx`** — הוספת `financialActions` ל-return object כדי לאפשר סינון client-side.

### סיכום קבצים

| קובץ | שינוי |
|-------|-------|
| `src/hooks/useRealtimeDashboard.ts` | חדש — realtime listener |
| `src/pages/Dashboard.tsx` | שורה אחת |
| `src/lib/data/getSummaryStats.ts` | staleTime + refetch |
| `src/hooks/useInsights.ts` | staleTime + refetch |
| `src/hooks/useBIAnalytics.tsx` | staleTime + expose raw actions |
| `src/hooks/useNotifications.tsx` | staleTime |
| `src/components/dashboard/TopProductsChart.tsx` | כפתורי שבוע/חודש/שנה + סינון |

