## Phase A — שינויי קוד

### 1. `src/App.tsx`

- **import** של `Subscribe` ושל `SubscriptionGuard`.
- **הוספת `<Route path="/subscribe" element={<Subscribe />} />`** כראוט ציבורי/אישי (בתוך `MainLayout`, מחוץ ל-Guard).
- **רה-ארגון של קבוצת ה-MainLayout** ל-3 קבוצות פנימיות:
  1. **ראוטים פתורים מנעילה** (בתוך MainLayout, ללא Guard): `/profile`, `/subscriptions`, `/subscribe`.
  2. **ראוטים עסקיים מוגנים** — עטופים ב-`<Route element={<SubscriptionGuard><Outlet/></SubscriptionGuard>}>`: `/dashboard`, `/inventory`, `/suppliers`, `/add-product`, `/reports`, `/settings`, `/settings/whatsapp`, `/procurement`, `/procurement/:id`.
  3. **ראוטי אדמין** — נשארים כמו שהם, ללא Guard (אדמין-מערכת פטור).
- שום שינוי ב-`ProtectedRoute` או בתפקידים.

### 2. `src/components/subscription/SubscriptionGuard.tsx`

- **הוספת bypass לאדמין-מערכת**: שימוש ב-`useUserRole` — אם `userRole === 'admin'`, מחזיר `children` מיידית. מתיישר עם memory: *Admin access policy*.
- שום שינוי בלוגיקת trial creation, redirect, או UI.

### 3. `src/pages/WhatsAppSettings.tsx`

- **הסרת `<SubscriptionGuard>` הפנימי** (השכבה החיצונית ב-App.tsx תטפל). השארת `MainLayout` הפנימי? לא — `MainLayout` כבר עוטף ברמת ה-Route, אז גם אותו אסיר כדי למנוע layout כפול.
- *לוודא לפני*: לבדוק שאין hooks/state ש-SubscriptionGuard סיפק (אין — הוא רק wrapper).

### מה לא משתנה
- `ProtectedRoute`, `useSubscription`, `useUserRole`, ראוטי אדמין, RLS, edge functions, עיצוב, פלואו trial creation.

---

## QA ידני (אחרי Phase A)

אבדוק 5 פרסונות דרך הדפדפן + ניווט ידני ל-URL מוגן:

| פרסונה | `/dashboard` | `/inventory` | `/procurement` | `/subscribe` | `/profile` | `/admin` |
|---|---|---|---|---|---|---|
| משתמש `active` | פתוח | פתוח | פתוח | פתוח | פתוח | חסום (Unauthorized) |
| משתמש `trial` תקף | פתוח + באנר | פתוח + באנר | פתוח + באנר | פתוח | פתוח | חסום |
| משתמש `expired` / `trial` פג | מסך "נדרש מנוי" / redirect | מסך "נדרש מנוי" | מסך "נדרש מנוי" | פתוח | פתוח | חסום |
| משתמש `cancelled` / `past_due` | מסך "נדרש מנוי" | מסך "נדרש מנוי" | מסך "נדרש מנוי" | פתוח | פתוח | חסום |
| `admin` (מערכת) | פתוח (bypass) | פתוח (bypass) | פתוח (bypass) | פתוח | פתוח | פתוח |
| `business employee` (`free_user`/`pro_starter_user`) | לפי `isSubscriptionActive` של בעל העסק | זהה | חסום ע"י ProtectedRoute (לא מורשה) | פתוח | פתוח | חסום |

**הערה לגבי `past_due`:** ב-DB constraint הקיים הסטטוסים הם `active|trial|expired|cancelled`. `past_due` לא קיים כסטטוס בפועל — `isSubscriptionActive` יחזיר false אוטומטית עבור כל מה שלא `active`/`trial` תקף, אז התנהגות זהה ל-`expired`.

**גישה ישירה ל-URL:** הדפדפן ינווט ידנית ל-`/inventory` ול-`/procurement/abc` עבור משתמש expired — אמור להציג את מסך "נדרש מנוי" של ה-Guard, לא את העמוד עצמו.

---

## Phase B — Hardening (לאחר אישור Phase A + QA)

### 4. `supabase/functions/meta-embedded-signup-complete/index.ts`
- **import** של `requireActiveBusinessOrRespond`.
- אחרי ולידציית `business_id`, לפני יצירת חיבור WABA — `const gate = await requireActiveBusinessOrRespond(serviceClient, business_id, { source: 'meta-embedded-signup-complete', action: 'connect_waba', corsHeaders }); if (gate) return gate;`.

### 5. cron jobs — סינון per-business
- **`supabase/functions/check-expiring-products/index.ts`** ו-**`supabase/functions/generate-weekly-stock-summary/index.ts`**:
  - בלולאה שעוברת על עסקים, לפני שליחת התראה לכל עסק → קריאה ל-`supabase.rpc('require_active_business', { p_business_id })`. אם שגיאה — `continue` (skip ושלא לפיל את כל ה-cron).
  - לא להחזיר 402 (זה cron, אין צרכן UI), פשוט לדלג ולתעד ב-console.

### 6. Audit `clever-service`
- קריאה של `index.ts` + grep לכל המקומות שקוראים אליו ב-frontend / outbox.
- סיווג: אם פעולה רגישה (כתיבה / שליחה חיצונית) → להוסיף gate. אם read-only / utility → להשאיר.
- החזרת ממצא לפני שינוי קוד.

---

## דליברבלים שאחזיר בסוף

1. **רשימת קבצים ששונו** (per phase).
2. **רשימת ראוטים מוגנים** עכשיו + ראוטים פתורים בכוונה.
3. **רשימת edge functions** שעברו gating חדש.
4. **טבלת QA** עם תוצאות בפועל ל-5 הפרסונות (לאחר Phase A).
5. **סיכוני רגרסיה שזוהו במהלך QA** (אם יש).

---

## סדר ביצוע
1. Phase A — 3 קבצים → אישור build → אריץ QA דרך הדפדפן → אחזיר טבלת תוצאות.
2. **המתנה לאישור** לפני Phase B.
3. Phase B — 3-4 edge functions → deploy → QA דרך `curl_edge_functions` + `edge_function_logs`.
