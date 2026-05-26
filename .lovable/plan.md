
## תכולה

זרימה production-grade שבה כפתור "בחר תוכנית" קורא ל-Edge Function אחת בלבד ומקבל בחזרה `checkout_url` מוכן להפניה.

## תנאי מקדים (חוסם)

יש להוסיף Secret חדש: **`MAKE_GROW_WEBHOOK_URL`** — כתובת ה-webhook של תרחיש Make שמייצר את ה-Payment Link ב-Grow ומחזיר `{ checkout_url }`.

לפני אישור התוכנית, הצעד הראשון יהיה לבקש את ה-Secret דרך כלי הסודות (המשתמש מזין בטופס מאובטח, לא בצ'אט).

## רכיבים שייווצרו / ישתנו

### 1. Edge Function חדשה — `supabase/functions/grow-start-checkout/index.ts`

זרימה פנימית:

1. **CORS + OPTIONS**
2. **אימות JWT** — `userClient.auth.getUser()` (אותו דפוס כמו `grow-create-subscription`)
3. **ולידציה** — Zod: `{ business_id: uuid, plan_id: string }`
4. **טעינת `businesses`** + בדיקת `owner_id === auth.uid`
5. **טעינת `subscription_plans`** (המחיר מהשרת בלבד)
6. **טעינת `profiles` + `emails`** ליצירת `customer`
7. **בניית payload** (פונקציה פנימית זהה ל-`buildGrowSubscriptionPayload`, משוכפלת ל-Edge כי `src/` לא נגיש מ-Deno)
8. **`INSERT` ל-`payment_sessions`** עם `status='pending_payment'`, `metadata={ payload, billing_cycle:'monthly', currency:'ILS' }`
9. **`INSERT` ל-`billing_events`** — `event_type='grow_session_created'`, `new_status='pending_payment'`
10. **קריאה ל-Make** — `POST` ל-`MAKE_GROW_WEBHOOK_URL` עם:
    - Body: `{ session_id, payload, callback_status_url }`
    - Header: `x-mlaiko-secret: GROW_WEBHOOK_SECRET` (אימות הדדי)
    - **Timeout: 15 שניות** דרך `AbortController` + `setTimeout`
11. **אם Make מחזיר 2xx + `checkout_url` תקין**:
    - `UPDATE payment_sessions SET status='payment_link_created', checkout_url=…, provider_session_id=…` לפי `session_id`
    - `INSERT billing_events` — `event_type='grow_payment_link_created'`, `new_status='payment_link_created'`
    - מחזיר `{ session_id, checkout_url }` (200)
12. **אם Make נכשל / timeout / חוסר `checkout_url`**:
    - `UPDATE payment_sessions SET status='failed'`
    - `INSERT billing_events` — `event_type='grow_checkout_failed'`, `new_status='failed'`, `metadata={ reason, http_status }`
    - מחזיר 502 עם `{ error: 'checkout_link_failed', detail }`

`verify_jwt = false` ב-`config.toml` (כמו שאר הפונקציות), אבל ה-JWT מאומת בקוד.

### 2. עדכון `src/pages/Subscribe.tsx`

ב-`handleSelectPlan` להחליף את הקריאה הקיימת מ-`grow-create-subscription` ל-**`grow-start-checkout`**:

```ts
const { data, error } = await supabase.functions.invoke('grow-start-checkout', {
  body: { business_id: activeBusinessId, plan_id: planId },
});
```

טיפול בתשובה:
- אם יש `data.checkout_url` → `window.location.href = data.checkout_url`
- אם אין → `toast.error('שגיאה ביצירת קישור התשלום')` + השארת `pendingPlanId` `null`
- מצב טעינה קיים (`Loader2` + "יוצר בקשת תשלום...") — נעדכן את הטקסט ל: **"יוצר עבורך קישור תשלום מאובטח..."**

### 3. מה לא ייגע

- `grow-create-subscription` — נשאר זמין (גם לצורך תאימות לאחור / debug)
- `grow-update-session-status` — נשאר כפי שהוא, ממשיך לקבל webhooks מ-Grow לעדכוני סטטוס סופיים (paid/failed)
- מבנה DB — שום שינוי, כל העמודות הדרושות כבר קיימות (`checkout_url`, `provider_session_id`, `status`)
- עיצוב, כפתורים, ראוטינג — ללא שינוי

## אבטחה

- `MAKE_GROW_WEBHOOK_URL` אך ורק ב-Edge Secret (לא מגיע לפרונט)
- אימות הדדי עם Make דרך `x-mlaiko-secret` (משתמש ב-`GROW_WEBHOOK_SECRET` הקיים)
- אימות בעלות עסק לפני כל פעולה
- מחיר נטען מהשרת בלבד — לא סומכים על הקלט מהלקוח
- ולידציית UUID למניעת `22P02`

## תרחישי כשל מטופלים

| תרחיש | תגובת UI | רישום |
|---|---|---|
| Make timeout (>15s) | toast "שגיאה ביצירת קישור התשלום" | `billing_events: grow_checkout_failed`, reason=timeout |
| Make מחזיר 5xx | toast שגיאה | `billing_events: grow_checkout_failed`, http_status |
| Make מחזיר 200 בלי `checkout_url` | toast שגיאה | `billing_events: grow_checkout_failed`, reason=missing_url |
| משתמש לא מורשה | 403 → toast "אין הרשאה" | — |

## חוזה Make (לתיעוד)

**Make מקבל** (POST):
```json
{
  "session_id": "uuid",
  "payload": { /* GrowPayload */ },
  "callback_status_url": "https://…/functions/v1/grow-update-session-status"
}
```
Header: `x-mlaiko-secret: <GROW_WEBHOOK_SECRET>`

**Make חייב להחזיר** (200):
```json
{ "checkout_url": "https://meshulam.co.il/…", "provider_session_id": "..." }
```

## סדר ביצוע לאחר אישור

1. בקשת `MAKE_GROW_WEBHOOK_URL` דרך כלי הסודות (חוסם)
2. יצירת `supabase/functions/grow-start-checkout/index.ts`
3. עדכון `src/pages/Subscribe.tsx` — שם הפונקציה + טקסט הטעינה
4. אימות: ניתן לבדוק את ה-Edge דרך `curl_edge_functions` לפני שמשתמשים בה ב-UI
