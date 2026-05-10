## חור קריטי שטרם תוקן

ב-`src/App.tsx` הנתיבים `/forgot-password` ו-`/reset-password` **כלל אינם רשומים**. ה-catch-all `<Route path="*" element={<Navigate to="/dashboard" replace />} />` תופס אותם, מפנה ל-`/dashboard`, ה-`ProtectedRoute` רואה משתמש לא מחובר ושולח ל-`/auth`.

תוצאה:
- לחיצה על "שכחתי את הסיסמה" ב-`/auth` → המשתמש מוקפץ בחזרה ל-`/auth` ולא רואה את הטופס.
- לחיצה על הקישור באימייל (`/reset-password?code=...`) → ה-redirect דורס את ה-URL ו-**הטוקן נזרק לפני שהקוד שלי מצליח לקרוא אותו**.

זה מסביר למה הפיצ'ר לא עבד מלכתחילה — התיקון הקודם ל-`ResetPassword.tsx` נכון לוגית אבל הרכיב לעולם לא נטען.

## תיקון

### `src/App.tsx`
להוסיף שני Public Routes לפני ה-`*`:

```tsx
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

// בתוך <Routes>, ליד /auth ו-/unauthorized:
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

חשוב: שניהם חייבים להיות **Public** (לא עטופים ב-`ProtectedRoute`) כי המשתמש מגיע אליהם לפני התחברות.

## בדיקות נוספות שעשיתי – בלי בעיות נוספות

- `Auth.tsx` כבר מכיל `<Link to="/forgot-password">` — אחרי הוספת הנתיב הקישור יעבוד.
- `ForgotPassword.tsx` קורא ל-`supabase.auth.resetPasswordForEmail` עם `redirectTo` נכון — תקין.
- `ResetPassword.tsx` (אחרי התיקון הקודם) תומך בשלושת הפורמטים: `?code=`, `?token_hash=&type=recovery`, ו-`#access_token=` — תקין.
- `useAuth` provider עוטף את `Routes` — `useNavigate` של ResetPassword יעבוד.
- ה-`onAuthStateChange` ב-`useAuth.tsx` יוצר trial subscription ב-SIGNED_IN — לא מפריע, כי המשתמש כבר היה רשום. בנוסף, אחרי הצלחה ResetPassword קורא `navigate('/auth')` ו-Auth יזהה משתמש מחובר וינווט ל-`/dashboard` — התנהגות טובה.

## תזכורת חיצונית (לא קוד)
ב-Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs** ודא שמופיעים:
- `https://www.mlaiko.com/reset-password`
- `https://mlaiko.com/reset-password`
- `https://mlaikop-osh-tza-1.lovable.app/reset-password`
- `https://id-preview--189c289a-9430-4114-9212-465332a6e893.lovable.app/reset-password`

בלי זה Supabase מתעלם מה-`redirectTo` ושולח את המשתמש ל-Site URL ללא הטוקן — ואז הטופס בכלל לא נטען עם פרטי האימות.

## מה לא משתנה
- אין שינוי ב-DB, ב-RLS, ב-edge functions או בעיצוב.
- אין שינוי בתוכן/לוגיקה של `ForgotPassword.tsx`, `ResetPassword.tsx`, `Auth.tsx` או `useAuth.tsx`.
- שינוי נקודתי ב-`App.tsx` בלבד: הוספת שתי שורות import ושני `<Route>`.
