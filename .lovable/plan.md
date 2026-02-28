

# Auth Page: Logo-first with Toggle to Auth Card

## Change
In `src/pages/Auth.tsx`, add `isAuthOpen` state (default `false`). 

**When `isAuthOpen === false`** (initial state):
- Left column (currently hero) shows the **large Mlaiko logo** centered vertically, max-w-[480px], using the existing uploaded SVG/PNG
- Right column (hero content) stays unchanged

**When `isAuthOpen === true`**:
- Left column swaps logo for the auth card (fade+scale animation, 200ms)
- Right column stays unchanged

## Trigger
- Navbar "התחברות" button: sets `isAuthOpen = true` + `activeTab = 'signin'`
- Navbar "הרשמה" button: sets `isAuthOpen = true` + `activeTab = 'signup'`

## Implementation in `src/pages/Auth.tsx`

1. Add state: `const [isAuthOpen, setIsAuthOpen] = useState(false);`

2. Update navbar buttons (lines 131-142): add `setIsAuthOpen(true)` alongside existing `setActiveTab()` calls

3. Replace left column content (lines 169-203) with conditional:
   - `!isAuthOpen`: Large logo block — `<div>` centered with `<img>` of existing logo, `max-w-[480px]`, vertically centered via flex
   - `isAuthOpen`: The current auth card (moved from right column)

4. Right column (lines 206-338): Always shows hero content (swap sides — hero moves to right, auth/logo on left). Actually per the prompt: "Right side hero content remains unchanged" — so hero stays right, logo/auth goes left. Currently hero IS on the left and auth IS on the right. Let me re-read...

The prompt says: "Display a large centered Mlaiko logo in the left section instead of the auth card." The auth card is currently on the RIGHT. So:

- **Right column** currently has the auth card → replace with logo by default, auth card when `isAuthOpen`
- **Left column** (hero) remains unchanged

5. Right column conditional (replacing lines 206-338):
   - `!isAuthOpen`: Large centered logo with fade-in
   - `isAuthOpen`: Auth card with `animation: authCardIn 200ms ease-out both` (opacity 0→1, scale 0.97→1)

6. Add CSS keyframe `authCardIn` alongside existing `authFadeIn`

7. Mobile: Same logic — logo shows above/below hero initially, replaced by auth card on trigger

## Files Modified
- `src/pages/Auth.tsx` only

