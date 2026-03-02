

## Plan: Scalability & Responsiveness — Phase-by-Phase

After reviewing the codebase, here are the specific issues found and the fixes organized in clear phases.

---

### Phase 1: MainLayout Infrastructure (Foundation)

**Current issues:**
- `useIsSidebarDrawer` uses raw `resize` event instead of `matchMedia` (less performant)
- The tablet toggle button (`!isSidebarDrawer && lg:hidden`) creates a dead zone — `isSidebarDrawer` is false when `>=1024px`, but `lg:hidden` hides the button at `>=1024px`, so it's never visible
- Drawer on mobile uses `vaul` which slides from bottom — not ideal for sidebar navigation
- Padding jumps from `p-3` to `p-4 md:p-6 lg:p-8` with no tablet middle ground

**Changes to `src/components/layout/MainLayout.tsx`:**
1. Replace `useIsSidebarDrawer` with `matchMedia`-based hook (like `useIsMobile` pattern)
2. Remove dead tablet toggle button code
3. Unify breakpoint logic: `<768px` = drawer, `768-1023px` = collapsible sidebar, `>=1024px` = fixed sidebar
4. Smooth padding: `p-3` mobile, `p-4` tablet, `p-6 lg:p-8` desktop
5. Add `safe-area-inset` padding for notched mobile devices

**Changes to `src/hooks/use-mobile.tsx`:**
- Add `useIsTablet()` hook (768-1023px range) for reuse across components

---

### Phase 2: Sidebar Responsiveness

**Current issues:**
- Sidebar header has fixed `h-32` + `w-24 h-24` logo — oversized on smaller screens
- No scroll indicator when menu overflows
- Footer copyright says "2024" (minor but noted)

**Changes to `src/components/layout/Sidebar.tsx`:**
1. Scale sidebar header: smaller logo on mobile drawer (`w-16 h-16` vs `w-24 h-24`)
2. Add `overscroll-contain` to scrollable nav area
3. Ensure touch targets are minimum 44px (already mostly done)

---

### Phase 3: Header Responsiveness

**Current issues:**
- Header has no mobile-specific sizing adjustments
- Dropdown menu could overflow on small screens

**Changes to `src/components/layout/Header.tsx`:**
1. Reduce padding on mobile (`px-3 py-2` vs `px-4 py-3`)
2. Ensure dropdown `DropdownMenuContent` has `max-w-[calc(100vw-2rem)]` to prevent overflow

---

### Phase 4: Dashboard Grid Improvements

**Current issues:**
- Charts use `h-64` fixed height — too tall on mobile, too short on large screens
- Bottom section uses `lg:grid-cols-3` which can be tight on tablets

**Changes to `src/pages/Dashboard.tsx`:**
1. Use responsive gap: `gap-3 md:gap-4 lg:gap-6`
2. Adjust grid breakpoints for tablet: `md:grid-cols-1 lg:grid-cols-2` for charts

**Changes to `src/components/dashboard/SummaryGrid.tsx`:**
1. Add `min-w-0` to grid items to prevent overflow

**Changes to `src/components/dashboard/RevenueChart.tsx` (and other chart components):**
1. Use responsive chart height: `h-48 md:h-56 lg:h-64`
2. Reduce chart margins on mobile

---

### Phase 5: Inventory Table Mobile Polish

**Current issues:**
- Mobile card actions overflow when multiple buttons appear (Edit + Send to Supplier + Request Quotes + Delete)
- `max-h-[60vh]` is hardcoded — should use flex layout instead

**Changes to `src/components/inventory/InventoryTable.tsx`:**
1. Wrap mobile action buttons with `flex-wrap` to handle overflow gracefully
2. Replace `max-h-[60vh]` with flex-based overflow
3. Add `gap-1.5` between mobile cards for tighter spacing on small screens

---

### Phase 6: Forms & Add Product Page

**Changes to `src/pages/AddProduct.tsx`:**
1. Ensure form grid uses `grid-cols-1 md:grid-cols-2` pattern
2. Add `w-full max-w-full` to prevent horizontal overflow on mobile

---

### Phase 7: Global CSS Safeguards

**Changes to `src/index.css`:**
1. Add `html { overflow-x: hidden; }` as safety net
2. Add smooth scrolling: `scroll-behavior: smooth`
3. Add `-webkit-tap-highlight-color: transparent` for cleaner mobile taps

---

### Summary

| Phase | Scope | Files |
|-------|-------|-------|
| 1 | Layout infrastructure | `MainLayout.tsx`, `use-mobile.tsx` |
| 2 | Sidebar | `Sidebar.tsx` |
| 3 | Header | `Header.tsx` |
| 4 | Dashboard grids & charts | `Dashboard.tsx`, `SummaryGrid.tsx`, chart components |
| 5 | Inventory table | `InventoryTable.tsx` |
| 6 | Forms | `AddProduct.tsx` |
| 7 | Global CSS | `index.css` |

All changes preserve existing design — no colors, fonts, or visual elements modified.

