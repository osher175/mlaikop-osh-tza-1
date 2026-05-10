# Refactor: Signup Flow & Profiles Architecture (Privacy-by-Design)

## 1. ניתוח הארכיטקטורה הקיימת

### טבלאות מעורבות (ממצאים מהקוד והפונקציות)

| טבלה | תפקיד נוכחי | בעיה ביחס למודל החדש |
|---|---|---|
| `auth.users` | זהות בסיסית (Supabase Auth) | תקין |
| `profiles` | `id, first_name, last_name, is_active, business_id, created_at` | מחזיק `business_id` (כפילות עם `user_businesses`), ללא `username`/`display_name`/`avatar_url` |
| `businesses` | `name, owner_id, business_category_id, industry, business_type, phone, address, ...` | תקין מבחינת מבנה, חסר `onboarding_completed` |
| `user_businesses` | `user_id, business_id, role` (ללא `id`) | תקין — נשאר עמוד השדרה של ה-membership |
| `user_roles` | `user_id, role, business_id` | משמש את `get_user_role()` ו-`has_role_or_higher()` — קריטי |
| `notification_settings` | נוצר היום ב-`OnboardingDecision` יחד עם business | יעבור ל-onboarding שלב 3 |
| `user_subscriptions` | מנוי פר-user (לא פר-business) | נשאר, אבל RLS לא יסתמך עליו לגישה |

### Triggers/Functions שתלויים במצב הנוכחי

- `handle_new_user()` — trigger על `auth.users` שיוצר `profiles` + `user_roles` (`free_user` או `admin`). **חייב לעבור עדכון** כדי לייצר גם `username` אוטומטי.
- `create_business_for_new_user(name, phone)` — RPC שמייצר business + ממלא `user_businesses` + `user_roles.business_id` + `profiles.business_id`. **בסיס מצוין ל-onboarding החדש**, צריך הרחבה.
- `is_business_name_available()` — נשאר.
- `get_user_role()`, `has_role_or_higher()` — קוראים מ-`user_roles`. נשארים.
- `require_premium()` — קורא `businesses.owner_id` → `user_subscriptions`. נשאר.
- כל ה-`log_*`, `audit_*`, `enqueue_low_stock_crossing` — תלויים ב-`business_id` קיים על שורות. ללא business עדיין → לא רץ. בטוח.

### Components / Pages שמושפעים

| קובץ | שינוי נדרש |
|---|---|
| `src/pages/Auth.tsx` | טופס signup מינימלי: email + password + username (אופציונלי). הסרת שדות עסק. |
| `src/hooks/useAuth.tsx` | `signUp` מקבל `username` במקום `firstName/lastName`. |
| `src/pages/OnboardingDecision.tsx` | הופך ל-onboarding wizard 3-שלבי. כיום מייצר business + role + notifications במכה אחת. |
| `src/pages/CreateBusiness.tsx` / `JoinBusiness.tsx` | מתואמים לפלואו החדש (אפשר להישאר נפרדים). |
| `src/components/OnboardingGuard.tsx` | בודק `businesses.onboarding_completed` במקום רק "יש business". |
| `src/components/SmartRedirect.tsx` | מפנה ל-`/onboarding` אם אין business או `onboarding_completed=false`. |
| `src/hooks/useBusinessAccess.tsx` | משתמש ב-`user_has_business_access` — נשאר, אבל הפונקציה תיבדק שתסתמך על `user_businesses`. |
| `src/pages/UserProfile.tsx` | מציג/עורך `username`, `display_name`, `avatar_url` (לא פרטי עסק). |

### RLS Policies תלויות במבנה הקיים (לבדיקה ועדכון)

- כל פוליסי שמסתמך על `profiles.business_id` — צריך להחליף ל-EXISTS על `user_businesses`.
- פוליסי שתלוי ב-`user_subscriptions.status='active'` לגישה לנתוני עסק — להסיר/להחליף ב-membership.
- Storage: `supplier-invoices`, `products` — לוודא שמתבסס על membership ב-business של הקובץ.
- Realtime על `recent_activity` — לוודא RLS דרך `user_businesses`.

### Edge Functions שתלויות ב-business בזמן signup

נסרקו: `procurement-*`, `meta-*`, `n8n-*`, `compress-storage-images`, `check-expiring-products`, `generate-weekly-stock-summary`, `send-admin-email`, `log-stock-alert`.
**אף אחת לא רצה כחלק מ-signup**. כולן מופעלות לאחר שיש business פעיל. → **בטוח** שלא יישבר דבר אם signup לא מייצר business.

### מה עלול להישבר אם business עדיין לא קיים?

1. כל hook שעושה `useBusiness()` ומניח שיש תוצאה (`useProducts`, `useReports`, `useNotifications`, `useSuppliers`, ...) — צריך שמירה על ה-`OnboardingGuard` שחוסם גישה לעמודי-עסק לפני שיש business.
2. `useUserRole()` יחזיר `free_user` ללא `business_id` — תקין כברירת מחדל.
3. `SmartRedirect` חייב להפנות ל-`/onboarding` במקום `/dashboard` כשאין business.
4. `Dashboard` ו-`MainLayout` — לא נטענים בלי `OnboardingGuard`. → בטוח.

---

## 2. תוכנית Migration בטוחה (4 שלבים)

### שלב 0 — הוספת שדות בלי לשבור (Non-breaking, additive)

**SQL Migration #1:**
- `profiles`: הוסף `username TEXT UNIQUE`, `display_name TEXT`, `avatar_url TEXT` (כולם nullable).
- `businesses`: הוסף `onboarding_completed BOOLEAN DEFAULT false`, `tax_id TEXT`, `logo_url TEXT`, `business_email TEXT`.
- Backfill: `businesses.onboarding_completed = true` לכל העסקים הקיימים (הם כבר פעילים).
- Backfill: `profiles.username = 'mlaiko-' || substr(id::text,1,8)` היכן ש-NULL.
- Backfill: `profiles.display_name = COALESCE(first_name || ' ' || last_name, username)`.
- עדכן `handle_new_user()`: בנוסף ל-first_name/last_name (תאימות), צור גם `username` אוטומטי (`mlaiko-XXXXX`) ו-`display_name`.
- צור RPC חדש `complete_business_onboarding(p_business_id uuid)` שמסמן `onboarding_completed=true` + יוצר `notification_settings` ברירת מחדל אם חסר.

**ללא הסרת עמודות ישנות בשלב זה.** `first_name/last_name` נשארים זמנית.

### שלב 1 — Frontend Signup חדש (Backward compatible)

- `Auth.tsx` — טופס signup מינימלי (email, password, username אופציונלי).
- `useAuth.signUp(email, password, username?)` — אם אין username, ה-DB יגנרט.
- ה-trigger הקיים ימשיך לאכלס `profiles` (עם `first_name=null` תקין).
- משתמשים קיימים לא מושפעים.

### שלב 2 — Onboarding Wizard

- שינוי `OnboardingDecision.tsx` ל-wizard 3-שלבי (state מקומי, או 3 routes):
  - שלב 1: business_name + business_type → קריאה ל-`create_business_for_new_user` (קיים, idempotent).
  - שלב 2: address + phone + business_email → `UPDATE businesses ...`.
  - שלב 3: notification_settings → קריאה ל-`complete_business_onboarding`.
- `OnboardingGuard` בודק `onboarding_completed=true` במקום רק קיום business.
- `SmartRedirect` שולח ל-`/onboarding` אם `onboarding_completed=false`.

### שלב 3 — RLS Hardening (מתואם עם תיקוני האבטחה הפתוחים)

נטפל בנפרד אחרי שמודל ה-membership מוצק:
- כל policy שתלוי ב-`profiles.business_id` → להחליף ב-`EXISTS (SELECT 1 FROM user_businesses WHERE user_id=auth.uid() AND business_id=...)`.
- הסרת policies שתלויות במנוי פעיל לצורך גישה (subscription gating נשאר רק ב-`require_premium` לפעולות פרימיום).
- Storage policies: ownership דרך `user_businesses`.
- בסוף השלב — אפשר להסיר `profiles.business_id` (deprecation) — **לא חלק מה-PR הזה**.

---

## 3. רשימת קבצים מושפעים (PR ראשון = שלבים 0-2)

**Migration:**
- חדש: `supabase/migrations/<timestamp>_profiles_minimal_signup.sql`

**Frontend:**
- `src/pages/Auth.tsx` — פישוט טופס signup
- `src/hooks/useAuth.tsx` — חתימת `signUp` חדשה
- `src/pages/OnboardingDecision.tsx` — wizard 3-שלבי
- `src/components/OnboardingGuard.tsx` — בדיקת `onboarding_completed`
- `src/components/SmartRedirect.tsx` — תנאי הפניה
- `src/pages/UserProfile.tsx` — שדות username/display_name/avatar (אם המשתמש מעוניין)

**ללא שינוי בשלב הזה:** Edge Functions, RLS על טבלאות עסקיות, subscriptions, hooks עסקיים.

---

## 4. ניתוח השפעת אבטחה

| נושא | לפני | אחרי שלב 2 | אחרי שלב 3 |
|---|---|---|---|
| Cross-business access | קיימים פערים (ראה scan) | ללא שינוי | מתוקן |
| Signup → אין business | מחייב business דרך onboarding | אותו דבר אבל הדרגתי | אותו דבר |
| Subscription gating | מעורבב ב-RLS | ללא שינוי | מבודד ל-`require_premium` |
| Privacy של profile | שומר first/last name | שומר רק username/display_name (חדשים) | אפשר להסיר first/last name |

---

## 5. אסטרטגיית Rollout

1. **PR 1** (זה): שלבים 0-2. פריסה → בדיקה ידנית של signup חדש + onboarding wizard + signup ישן (משתמשים קיימים נכנסים לדשבורד כרגיל בזכות backfill `onboarding_completed=true`).
2. **PR 2**: RLS hardening לפי תוצאות security scan + מעבר policies ל-`user_businesses`.
3. **PR 3** (אופציונלי, מאוחר): הסרת `profiles.business_id`, `first_name`, `last_name` — רק לאחר ולידציה שאין צרכנים.

---

## 6. מה מבקש לאישור לפני implementation

- אישור לתוכנית הזו ככלל.
- האם להמשיך גם ל-PR 2 (RLS) באותה סשן או רק PR 1?
- האם להציג ל-username שדה גם ב-Auth screen, או תמיד לגנרט אוטומטית ולתת לערוך אחר כך ב-Profile?
