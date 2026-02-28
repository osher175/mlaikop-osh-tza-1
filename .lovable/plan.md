

# Enterprise Auth Page Redesign — Mlaiko

## Scope
Complete rewrite of `src/pages/Auth.tsx` into a premium enterprise-grade authentication page. No changes to auth logic, hooks, or routing — only the visual layer.

## Single File Change
**`src/pages/Auth.tsx`** — Full rewrite with inline styles/Tailwind. All logic (signIn, signUp, useAuth, toast, navigate, loading states) preserved exactly.

## Layout Structure

```text
┌──────────────────────────────────────────────────────┐
│  NAVBAR (fixed, 72px, white, subtle shadow)          │
│  [Logo + "by TriggeX Technologies"]    [התחברות הרשמה │ צור קשר] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐   │
│  │  HERO (EN, LTR)     │  │  AUTH CARD (HE, RTL) │   │
│  │  55% width          │  │  45% width           │   │
│  │                     │  │  Tabs: התחברות│הרשמה  │   │
│  │  Title + Subtitle   │  │  Forms + CTA         │   │
│  │  3 Bullet Points    │  │                      │   │
│  └─────────────────────┘  └──────────────────────┘   │
│                                                      │
├──────────────────────────────────────────────────────┤
│  FOOTER: © 2026 TriggeX Technologies                 │
└──────────────────────────────────────────────────────┘
```

Mobile: Stack vertically (hero → card). Navbar compact.

## Design Tokens (applied via Tailwind classes + inline style overrides)

| Token | Value |
|---|---|
| Background | #F8FAFC |
| Card BG | #FFFFFF |
| Primary Turquoise | #14B8A6 |
| Primary Mango | #F59E0B |
| Text Primary | #0F172A |
| Text Secondary | #475569 |
| Border | rgba(15,23,42,0.08) |
| Card Shadow | 0 20px 40px rgba(15,23,42,0.08) |
| Card Radius | 20px |
| Button Radius | 12px |
| Input Radius | 10px |

## Implementation Details

1. **Background**: Base #F8FAFC + two absolute-positioned radial gradient divs (turquoise top-right ~5% opacity, mango bottom-left ~4% opacity, both blurred)

2. **Navbar**: Fixed top, white bg, h-[72px], flex between logo group and nav links. Logo uses existing uploaded image. "by TriggeX Technologies" in small secondary text below. Right side: two text links + divider + outline "צור קשר" button with turquoise border

3. **Hero section** (left/LTR, `dir="ltr"`):
   - H1: "Inventory Intelligence for Modern Businesses" — text-4xl/5xl font-bold tracking-tight
   - Subtitle paragraph — text-lg text-secondary
   - 3 bullets with lucide icons (Bell, Cpu, BarChart3) — thin stroke, monochrome

4. **Auth Card** (right/RTL, `dir="rtl"`):
   - White, rounded-[20px], shadow, padding 40px
   - Custom tab bar: no background fill, turquoise underline on active, 150ms transition
   - Form fields: with left-aligned icons (Mail, Lock, User), floating-style labels, border rgba(15,23,42,0.08), focus ring turquoise
   - CTA button: Mango #F59E0B, rounded-xl, text "המשך למערכת", hover darkens slightly
   - "שכחתי את הסיסמה" link preserved

5. **Footer**: Centered, small text-secondary, "© 2026 TriggeX Technologies · Engineered with scalable architecture"

6. **Animations**: Only opacity fade-in on mount (CSS animation, 400ms). No slide/bounce.

7. **Responsive**: Below lg breakpoint, switch to single column (hero stacked above card). Navbar links collapse to minimal.

## What stays unchanged
- All auth logic (signIn, signUp handlers)
- useAuth hook usage
- Form validation
- Toast messages
- Navigation/redirect logic
- Route configuration in App.tsx
- ForgotPassword link

