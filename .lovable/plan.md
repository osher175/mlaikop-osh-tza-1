

## Plan: Refined TriggeX Footer Signature

### Changes to `src/pages/Auth.tsx` (lines 159-165)

Replace the current stacked vertical footer with a horizontal, restrained signature:

- **Footer container**: `py-6` (24px padding), subtle top border `border-t border-[#E2E8F0]`, centered
- **Link layout**: Switch from `flex-col` to `flex items-center gap-3` (horizontal, single line)
- **Logo**: Downsize from `h-[48px]` to `h-[32px]`, keep `w-auto object-contain`
- **Note on SVG**: The current file is `/images/triggex-logo.png`. If an SVG version exists, use it. If not, keep the PNG — no file creation in this edit.
- **Text**: Keep `text-[11px] tracking-[0.08em] uppercase font-medium`
- **Hover behavior**: Retain existing color transition (`#94A3B8` → `#475569`) and opacity shift

Result: one clean horizontal line — logo + text — with a thin border above. Confident but restrained.

### Files
- `src/pages/Auth.tsx` — single edit, lines 159-165

