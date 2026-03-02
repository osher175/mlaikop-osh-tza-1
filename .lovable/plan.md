

## Plan: Professional Logo Integration (UX/UI Approach)

The current problem: Two separate Mlaiko logos competing for attention -- one faded above the headline, one oversized inside the dashboard card. This creates visual noise and dilutes brand presence.

### Design Decision: Single Logo, Maximum Impact

**Remove** the standalone logo from the hero text column (line 124). It's redundant and weakens the hierarchy.

**Redesign** the dashboard card header to use the logo as a proper product chrome element -- like how Linear, Notion, or Figma show their logo in app headers.

### Dashboard Card Header (lines 89-98)

Replace the current stacked layout (big logo + "Operations Center" below) with a horizontal app-bar pattern:

```text
[ Mlaiko Logo (24px) ]  Mlaiko  |  Operations Center    [● ● ●]
```

Structure:
- Horizontal flex row, vertically centered
- Logo: `h-[24px]` -- small enough to feel like real product chrome, not a billboard
- Wordmark "Mlaiko" next to logo: `text-sm font-semibold`, color `#0F172A`
- Thin vertical separator: 1px line, `#E2E8F0`, 16px height
- "Operations Center": `text-sm font-medium`, color `#64748B`
- Status dots pushed to the right with `ml-auto`

This mimics how real SaaS products display their brand in the top-left of the app shell. It feels authentic, not decorative.

### Hero Text Column (line 124)

Remove the faded logo image entirely. The headline "Inventory Intelligence" is strong enough to stand alone. The logo inside the dashboard preview already anchors the brand visually.

### Files to modify
- `src/pages/Auth.tsx` -- 2 edits: remove hero logo (line 124), redesign dashboard header (lines 89-98)

