

## Plan: Auth Page Layout Adjustments

### 1. Navbar — Remove Mlaiko logo (line 73)
- Delete the `<img>` tag on line 73 that renders the Mlaiko logo
- Keep only the nav buttons (התחברות / הרשמה)

### 2. Hero — Adjust Mlaiko logo sizing (line 124)
- Change from `h-9 w-auto mb-8` to `h-[30px] w-auto mb-4` (30px height, 16px bottom margin)
- Already left-aligned with headline — no positioning change needed

### 3. Footer — Add TriggeX logo + clickable link (lines 159–162)
- Save uploaded TriggeX logo to `public/images/triggex-logo.png`
- Replace the `<footer>` content with a single `<a>` linking to `https://www.triggex.net` (target=_blank, rel=noopener noreferrer)
- Inside the link: flex row with TriggeX logo (h-[20px]) + gap-2 + text "TriggeX Technologies © 2026"
- Color: `#94A3B8`, hover: `#475569`
- Transition on hover for both text and logo opacity

### Files to modify
- `src/pages/Auth.tsx` — 3 targeted edits (navbar logo removal, hero logo resize, footer upgrade)
- `public/images/triggex-logo.png` — copy from uploaded asset

