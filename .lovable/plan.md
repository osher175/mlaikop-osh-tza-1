## הבעיה

הקישור באימייל איפוס הסיסמה של Supabase (גרסאות חדשות, PKCE flow) מחזיר את המשתמש ל-`/reset-password` עם פרמטר `?code=...` ב-query string, או עם `?token_hash=...&type=recovery`. הקובץ `src/pages/ResetPassword.tsx` בודק רק `#access_token` ו-`#refresh_token` ב-hash — לכן הוא תמיד נופל ל-else, מציג "קישור איפוס הסיסמה אינו תקין" ומפנה ל-`/auth`. זו הסיבה שהפיצ'ר נראה לא עובד.

## מה אתקן

### 1. `src/pages/ResetPassword.tsx` – תמיכה בכל פורמטי הקישור
ב-`useEffect` אטפל בשלושה מקרים לפי הסדר:
1. **PKCE** – אם יש `?code=...` ב-query → `supabase.auth.exchangeCodeForSession(code)`
2. **OTP token_hash** – אם יש `?token_hash=...&type=recovery` → `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`
3. **Legacy implicit** – אם יש `#access_token` + `#refresh_token` ב-hash → `supabase.auth.setSession(...)` (הקוד הקיים)
4. רק אם אף אחד מהשלושה לא קיים → להציג שגיאה ולהפנות ל-`/auth`

לאחר הצלחה אנקה את ה-URL (`window.history.replaceState`) כדי שלא יישאר טוקן ב-address bar, ואקבע `setIsValidSession(true)`.

### 2. `src/hooks/useAuth.tsx` – יישור `resetPassword`
הפונקציה הנוכחית קוראת `resetPasswordForEmail(email)` בלי `redirectTo`. אוסיף `redirectTo: ${window.location.origin}/reset-password` כדי שתהיה עקבית עם הקריאה הישירה ב-`ForgotPassword.tsx` ולא תפנה לכתובת ברירת מחדל אם תיקרא בעתיד.

### 3. הוראה למשתמש (לא קוד)
לוודא ב-Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: כתובת הפרודקשן (`https://www.mlaiko.com` או `https://mlaiko.com`)
- **Redirect URLs**: להוסיף את כל אלה אם חסרים:
  - `https://www.mlaiko.com/reset-password`
  - `https://mlaiko.com/reset-password`
  - `https://mlaikop-osh-tza-1.lovable.app/reset-password`
  - `https://id-preview--189c289a-9430-4114-9212-465332a6e893.lovable.app/reset-password`

בלי זה Supabase מתעלם מה-`redirectTo` ושולח את המשתמש ל-Site URL ללא הטוקן.

## מה לא משתנה
- העיצוב, הטקסטים והלוגיקה של `ForgotPassword.tsx` נשארים זהים.
- אין שינוי ב-DB, ב-RLS או ב-edge functions.
- אין שינוי ב-`Auth.tsx` או בנתיבים ב-`App.tsx`.

## פרטים טכניים

```ts
// pseudo-code – ResetPassword useEffect
const url = new URL(window.location.href);
const code = url.searchParams.get('code');
const tokenHash = url.searchParams.get('token_hash');
const type = url.searchParams.get('type');
const hash = new URLSearchParams(window.location.hash.slice(1));
const accessToken = hash.get('access_token');
const refreshToken = hash.get('refresh_token');

if (code) {
  await supabase.auth.exchangeCodeForSession(code);
} else if (tokenHash && type === 'recovery') {
  await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
} else if (accessToken && refreshToken) {
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
} else {
  // show error + navigate('/auth')
}
```

לאחר ההצלחה: `window.history.replaceState({}, '', '/reset-password')` ו-`setIsValidSession(true)`.
