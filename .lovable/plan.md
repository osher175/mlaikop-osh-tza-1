## Issues confirmed

1. **Toggle only reflects after refresh** – `useCostVisibility` (`src/hooks/useCostVisibility.tsx`) uses `useState` locally inside each component. `InventoryHeader` and `InventoryTable` each hold an independent copy. When the header toggles, localStorage updates but the table's state doesn't re-render until the component remounts (page refresh).

2. **Cost not visible in desktop PC view** – `InventoryTable.tsx` desktop `<table>` (lines 308–405) has columns: תמונה / שם / ברקוד / קטגוריה / כמות / מחיר / מיקום / סטטוס / פעולות. There is **no "עלות" column at all**. The cost cell exists only in the mobile/tablet card view (line 212–216).

## Fix plan (UI/presentation only — no billing, no business logic)

### 1. Make `useCostVisibility` a shared store
Rewrite `src/hooks/useCostVisibility.tsx` to use a small module-level store with subscribers (via `useSyncExternalStore`), keeping the same API (`{ hidden, toggle, maskCost }`) and same localStorage key `mlaiko:hide-cost`. Any component that calls the hook re-renders instantly on toggle — no refresh needed. Also add a `storage` event listener so multiple tabs stay in sync.

### 2. Add "עלות" column to the desktop table
In `src/components/inventory/InventoryTable.tsx`:
- Add a new `<th>` "עלות" between "מחיר" (line 316) and "מיקום" (line 317), `min-w-[100px]`.
- Add matching `<td>` rendering `{costHidden ? '₪●●●' : `₪${product.cost || '-'}`}` between the price cell (line 346) and location cell (line 347).
- Reuse the existing `costHidden` value already destructured on line 49.

No other files touched. No changes to the header toggle button, no changes to card view, no changes to any billing/subscription code (freeze respected).

### Files
- `src/hooks/useCostVisibility.tsx` – rewrite with shared external store.
- `src/components/inventory/InventoryTable.tsx` – add עלות column (header + cell) in desktop table.

### Verification
- Toggle "הסתר עלות / הצג עלות" in the header on desktop → the עלות column values switch immediately between `₪●●●` and the actual number, with no page refresh.
- Same behavior on tablet/mobile card view.
- Refresh preserves the last chosen state (localStorage).
