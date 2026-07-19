
## מטרה
לוודא שמנגנון "תקופת ניסיון ולאחר מכן חסימת שימוש עד לתשלום" **לא פעיל כרגע**, בלי להסיר או לשנות את הקוד הקפוא (`CODE_FREEZE_SUBSCRIPTION.md`).

## מצב נוכחי (מאומת)
המנגנון פעיל בשלוש שכבות:
- **Frontend**: `SubscriptionGuard` עוטף את כל ה-routes העסקיים ב-`App.tsx`; `BillingReadOnlyBanner` ב-`MainLayout`; `useBusinessBillingStatus` + `useRequireCanWriteAction` חוסמים פעולות כתיבה.
- **Edge Functions**: `requireActiveBusinessOrRespond` + `require_active_business` RPC ב-11+ פונקציות (procurement, meta, log-stock-alert, crons).
- **DB**: `require_active_business` RPC מחזיר שגיאה למי שלא active/trial; `ensure_trial_subscription` נקרא ב-`useAuth` וב-`useSubscription`.

## גישה: Kill-Switch גלובלי (ללא שינוי לוגיקה קפואה)
נוסיף דגל אחד `BILLING_LOCK_ENABLED` בשתי נקודות כניסה קפואות מאוד, שכשהוא `false` — כל ההגבלה נעקפת. הקוד עצמו נשאר, אבל לא מפעיל שום חסימה. זה שומר על הכוונה של ה-freeze (לא לשבור את המנגנון) ומאפשר החזרה עתידית בהחלפת דגל אחד.

### שינויים מוצעים

**1. Frontend flag** — `src/lib/billing/featureFlag.ts` (קובץ חדש)
```ts
export const BILLING_LOCK_ENABLED = false;
```

**2. `src/hooks/useBusinessBillingStatus.tsx`** (קובץ קפוא — דורש אישור לפי mandate)
בראש ה-hook, אם `!BILLING_LOCK_ENABLED` → להחזיר `status: 'active'`, `canWrite: true`, `isReadOnly: false` (בדיוק כמו bypass של admin שכבר קיים שם). זה מנטרל אוטומטית:
- `SubscriptionGuard` (משתמש ב-hook הזה)
- `BillingReadOnlyBanner` (משתמש ב-hook הזה)
- `useRequireCanWriteAction` (משתמש ב-hook הזה)
- כל כפתור/פעולה שמסתמכת עליהם

**3. `supabase/functions/_shared/billing.ts`** (קובץ קפוא — דורש אישור)
בראש `requireActiveBusinessOrRespond`, אם `Deno.env.get('BILLING_LOCK_ENABLED') !== 'true'` → `return null` (עובר את השער תמיד). זה מנטרל את כל 11 ה-Edge Functions ואת ה-crons שקוראים ל-RPC דרך helper זה. עבור שתי הפונקציות שקוראות `require_active_business` ישירות (`generate-weekly-stock-summary`, `check-expiring-products`) — או שנרצה לעטוף גם אותן בבדיקת הדגל, או להשאיר (הן crons, לא חוסמות משתמש). אמליץ לעטוף לעקביות.

**4. secret** — להוסיף `BILLING_LOCK_ENABLED=false` דרך `add_secret` כדי שה-Edge Functions יקראו אותו. ברירת מחדל אם חסר: מנוטרל (safe default עכשיו).

### מה **לא** משתנה
- `require_active_business` RPC בבסיס הנתונים — נשאר כפי שהוא.
- `activate_subscription_on_paid` trigger — נשאר.
- `ensure_trial_subscription` — נשאר (יוצר trial ברישום, לא חוסם).
- כל הראוטים, ה-guards, ה-banner components — נשארים, פשוט לא מציגים/חוסמים כלום.
- מסלול Grow ותשלום — נשאר פעיל למי שירצה להירשם ידנית.
- `SubscriptionPlans` / `Subscribe.tsx` — נגישים ידנית מהמנוי.

## אישור freeze נדרש
לפי `mem://constraints/billing-code-freeze`, שינוי ב-`useBusinessBillingStatus.tsx` וב-`_shared/billing.ts` מחייב:
1. עצירה + הפניה ל-`CODE_FREEZE_SUBSCRIPTION.md`.
2. הצגת הקבצים המושפעים: `src/hooks/useBusinessBillingStatus.tsx`, `supabase/functions/_shared/billing.ts`, `src/lib/billing/featureFlag.ts` (חדש).
3. **אישור מפורש שלך** לבצע את השינוי הזה למרות ה-freeze.

## אחרי היישום (וידוא)
- לרענן את האפליקציה — הבאנר הצהוב לא מופיע לאף משתמש.
- Owner עם `status='none'` יכול לגשת לכל הראוטים העסקיים ולבצע פעולות כתיבה.
- קריאה ל-Edge Function `procurement-start-outreach` לעסק ללא מנוי — לא מחזירה 402.

## אופציה חלופית
אם תעדיף לא לגעת בכלל בקבצים הקפואים — אפשרות מינימלית: להריץ מיגרציה שמחליפה את `require_active_business` שיחזיר תמיד `true`, ולעטוף את `SubscriptionGuard` ו-`BillingReadOnlyBanner` בפידור UI קפוא. זה פחות נקי (מסתיר סיבה בלוגיקה במקום בדגל מפורש) — אמליץ נגד.

**נא לאשר את הגישה עם ה-Kill-Switch לפני מעבר ל-build.**
