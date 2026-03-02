

## Plan: TriggeX Footer — Stacked Brand Signature

Current layout is a horizontal row (logo + text side by side) — feels like a footnote. Redesign as a vertical, centered brand stamp.

### New Structure

```text
     [ TriggeX Logo (h-24px) ]
   TriggeX Technologies © 2026
```

### Changes to `src/pages/Auth.tsx` (lines 159-165)

Replace the current `<footer>` with:

- **Container**: `py-10 flex justify-center` (more breathing room)
- **Link**: `flex flex-col items-center gap-2` (vertical stack, centered)
- **Logo**: Increase from `h-[20px]` to `h-[24px]` — slightly more presence
- **Text**: `text-[11px] tracking-[0.08em] uppercase font-medium` — small-caps engineering signature style
- **Color**: Keep `#94A3B8` base, hover to `#475569` with `transition-all duration-200`
- **Hover**: Both logo and text transition together via the parent `<a>` tag; add subtle `opacity-80 → opacity-100` on hover for the logo

Single edit, 7 lines.

