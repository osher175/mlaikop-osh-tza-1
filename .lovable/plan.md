

# Add TriggeX Attribution to Navbar

## Change: `src/pages/Auth.tsx`

### 1. Copy uploaded logo to project
Copy `user-uploads://לוגו_מבריק.png` to `public/images/triggex-logo.png`

### 2. Update navbar left section (lines 120-129)
Replace the current "by TriggeX Technologies" text with a hyperlink group:

```tsx
<div className="flex items-center gap-3">
  <img src="/lovable-uploads/5d780163-bc98-49af-94ab-14ac38bf11f4.png" alt="Mlaiko Logo" className="h-9 object-contain" />
  <a
    href="https://www.triggex.net"
    target="_blank"
    rel="noopener noreferrer"
    className="hidden sm:flex items-center gap-2 transition-opacity duration-150 hover:opacity-70"
    style={{ color: '#475569' }}
  >
    <span className="text-xs" style={{ color: '#475569' }}>Developed by TriggeX Technologies</span>
    <img src="/images/triggex-logo.png" alt="TriggeX Technologies" className="h-5 object-contain" />
  </a>
</div>
```

Key details:
- Single `<a>` wrapping text + logo
- `target="_blank"` + `rel="noopener noreferrer"`
- Hover: opacity reduction via `hover:opacity-70`
- Logo height: `h-5` (20px)
- Gap between text and logo: `gap-2` (8px)
- Text: small, not bold, secondary color
- Mobile: stays visible via `sm:flex`, compact spacing

