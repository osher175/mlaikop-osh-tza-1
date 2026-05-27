# Billing Lock – Architecture & QA Reference

מסמך זה מסכם את מערכת חסימת הגישה לפי סטטוס מנוי (Billing Lock) ב-Mlaiko.
מקור האמת היחיד הוא **`business_billing_status(business_id)`** ברמת ה-DB.

---

## 1. איך עובד Billing Lock

הגישה למשאבי העסק נקבעת **ברמת העסק**, לא ברמת המשתמש. כל חברי העסק
(owner + employees) חולקים את אותו סטטוס:

```
user logs in
   ↓
useBusinessAccess  →  business_id של המשתמש
   ↓
useBusinessBillingStatus  →  RPC: business_billing_status(business_id)
   ↓
SubscriptionGuard מחליט:
   • active / trial    →  גישה פתוחה
   • restricted        →  מסך נעילה
   • cancelled/expired →  מסך נעילה
```

### סטטוסים אפשריים

| סטטוס | משמעות | גישה |
|---|---|---|
| `active` | מנוי בתשלום פעיל | ✅ פתוח |
| `trial` | תקופת ניסיון בתוקף | ✅ פתוח (+ באנר ספירה לאחור ל-owner) |
| `restricted` | trial הסתיים / חסר plan | ❌ נעול |
| `cancelled` | מנוי בוטל | ❌ נעול |

---

## 2. Routes – מוגנים ופתוחים

### פתוחים (ללא Billing Guard)

| Route | הערות |
|---|---|
| `/` , `/auth` | landing / login |
| `/subscribe` | בחירת תוכנית – חייב להישאר פתוח גם למנוי שפג |
| `/profile` | פרופיל בסיסי |
| `/admin/*` | מסכי admin – מחוץ ל-`SubscriptionGuard` Outlet |

### מוגנים (עטופים ב-`<SubscriptionGuard><Outlet/></SubscriptionGuard>`)

`/dashboard`, `/inventory`, `/suppliers`, `/add-product`, `/reports`,
`/settings`, `/settings/whatsapp`, `/procurement`, `/procurement/:id`

הגדרה ב-`src/App.tsx`:

```tsx
<Route element={<SubscriptionGuard><Outlet /></SubscriptionGuard>}>
  <Route path="/dashboard" ... />
  <Route path="/inventory" ... />
  {/* ... */}
</Route>
```

---

## 3. איך Grow payment מפעיל subscription

```
[1] /subscribe → user clicks plan
[2] edge fn: grow-start-checkout
       → Make webhook
       → creates payment_sessions row (status='payment_link_created')
       → returns checkout_url + provider_session_id
[3] user redirected to Grow payment page
[4] Grow webhook → edge fn: grow-update-session-status
       → UPDATE payment_sessions SET status='paid'
[5] DB trigger: trg_activate_subscription_on_paid
       → activate_subscription_on_paid()
       → upsert user_subscriptions (status='active', period_end=now()+1mo)
       → INSERT billing_events (subscription_activated)
[6] SubscriptionGuard refetches → business_billing_status='active'
       → access opens automatically for owner + all employees
```

### Idempotency

הטריגר מוגן בשתי שכבות:

1. **`WHEN`**: `NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid'`
   – לא נורה על UPDATE שלא משנה את הסטטוס.
2. **בדיקת `billing_events`**: לפני upsert, בודקים אם קיים כבר
   `subscription_activated` עם אותו `payment_session_id` במטה-דאטה.

---

## 4. מקור האמת: `business_billing_status`

פונקציית DB `business_billing_status(p_business_id uuid) RETURNS text`.

- מחזירה `active` / `trial` / `restricted` / `cancelled`.
- מבוססת על מנוי ה-**owner** של העסק (`businesses.owner_id`), לא על
  המשתמש המחובר.
- משמשת גם את ה-frontend (`useBusinessBillingStatus`), גם פונקציות DB
  אחרות (`notify_out_of_stock`), וגם כל RLS שמסתמכת על סטטוס פעיל.

> ⚠️ **אל תבדוק `user_subscriptions` ישירות בקוד אפליקציה** – זה ייצור
> חוסר עקביות בין owner ל-employee. תמיד דרך `business_billing_status`.

---

## 5. גישת עובדים לפי מנוי העסק

עובד (employee) **לא** מחזיק שורת `user_subscriptions` משלו.
ב-`SubscriptionGuard`:

```tsx
const isOwner = !!businessContext?.is_owner;

// gate משותף לכולם:
if (businessId && businessCanWrite) return <>{children}</>;

// במסך הנעילה:
{isOwner && <Button>בחר תוכנית מנוי</Button>}
// עובד לא רואה כפתור תשלום – רק הודעה "פנה למנהל העסק"
```

תוצאה:
- עסק `active` → owner + כל העובדים נכנסים.
- עסק `expired` → owner רואה מסך נעילה **עם** כפתור `/subscribe`,
  עובד רואה מסך נעילה **בלי** כפתור.

---

## 6. Admin bypass

מנהלי פלטפורמה (`userRole === 'admin'`) עוקפים את הגייט לחלוטין:

```tsx
// SubscriptionGuard.tsx
if (userRole === 'admin') {
  return <>{children}</>;
}
```

בנוסף, ראוטי `/admin/*` ב-`App.tsx` מוגדרים **מחוץ** ל-`SubscriptionGuard`
Outlet, כך ש-admin לעולם לא נחסם – לא בראוטים שלו ולא בראוטים עסקיים.

---

## 7. Edge Functions עם Billing Gate

| Function | Gate | התנהגות כשהעסק לא פעיל |
|---|---|---|
| `grow-start-checkout` | פתוחה במכוון | חייבת לעבוד גם ל-expired (כדי לאפשר תשלום) |
| `grow-update-session-status` | פתוחה (webhook חיצוני) | חתימת Grow מאמתת |
| `notify_out_of_stock` (DB function) | ✅ מגודר | לא שולח webhook ל-clever-service, רושם `billing_events`, ממשיך לעדכן מלאי |
| פעולות כתיבה רגישות (procurement, settings) | RLS דרך `business_billing_status` | חסום ב-DB level |

`notify_out_of_stock` הוא הדוגמה הקנונית לגייטינג ברמת DB function: בודק
`business_billing_status` לפני `pg_net.http_post`, מדלג בשקט כשהעסק לא
פעיל, ולעולם לא מפיל עדכוני מלאי.

---

## 8. QA Checklist – איך לבדוק בעתיד

### 8.1 בדיקות frontend (browser)

| תרחיש | ציפייה |
|---|---|
| Owner expired → `/dashboard` | מסך נעילה + כפתור "בחר תוכנית מנוי" → `/subscribe` |
| Owner active → `/dashboard /inventory /procurement` | פתוח |
| Employee של עסק active → `/dashboard` | פתוח |
| Employee של עסק expired → `/dashboard` | מסך נעילה **ללא** כפתור תשלום |
| Admin → `/admin/*` ו-`/dashboard` | פתוח בכולם |

### 8.2 בדיקות DB (אחרי Grow payment)

```sql
-- 1. סשן עבר ל-paid
SELECT id, status, business_id, plan_id
FROM payment_sessions
WHERE id = '<session_id>';

-- 2. trigger יצר/עדכן user_subscriptions
SELECT user_id, status, plan_id, current_period_end, provider_payment_id
FROM user_subscriptions
WHERE business_id = '<business_id>';

-- 3. business_billing_status מחזיר active
SELECT business_billing_status('<business_id>');

-- 4. billing_events כולל subscription_activated (פעם אחת בלבד)
SELECT event_type, source, COUNT(*)
FROM billing_events
WHERE business_id = '<business_id>'
  AND source = 'payment_sessions_paid_trigger'
GROUP BY event_type, source;

-- 5. הטריגרים מופעלים
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname IN ('trg_activate_subscription_on_paid', 'trg_notify_out_of_stock');
-- tgenabled = 'O' = enabled
```

### 8.3 בדיקת Idempotency

עדכון נוסף של `payment_sessions.status` ל-`paid` (paid→paid) **לא** צריך
ליצור שורת `billing_events` נוספת – ה-`WHEN` של הטריגר חוסם.

### 8.4 בדיקת notify_out_of_stock למול עסק לא פעיל

- מורידים מוצר ל-0 בעסק `restricted`.
- צפוי: אין קריאה ל-clever-service, יש שורה ב-`billing_events` עם
  `event_type` מתאים, מלאי התעדכן בהצלחה.

---

## 9. קבצים רלוונטיים

| תפקיד | נתיב |
|---|---|
| Guard component | `src/components/subscription/SubscriptionGuard.tsx` |
| Billing status hook | `src/hooks/useBusinessBillingStatus.tsx` |
| Business context | `src/hooks/useBusinessAccess.tsx` |
| Routes definition | `src/App.tsx` |
| Activation trigger migration | `supabase/migrations/20260527111543_*.sql` |
| `notify_out_of_stock` billing-gate migration | `supabase/migrations/20260527110342_*.sql` |
| Grow checkout | `supabase/functions/grow-start-checkout/` |
| Grow webhook | `supabase/functions/grow-update-session-status/` |
