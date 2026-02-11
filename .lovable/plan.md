

# Low-Stock Automation Trigger -- Implementation Plan

## Overview
Implement a production-grade, crossing-only low-stock automation system using an outbox pattern. This ensures that only genuine threshold crossings (after the feature is enabled) generate events -- preventing false alerts for products already below threshold.

---

## Part A: Add "Official Enable Time" Column

**What**: Add `low_stock_enabled_at timestamptz` to `notification_settings`.

**How**: A single SQL migration will:
1. Add the column (nullable, no default).
2. Create a trigger `trg_set_low_stock_enabled_at` on `notification_settings` that fires BEFORE UPDATE. When `low_stock_enabled` changes from `false` to `true` and `low_stock_enabled_at IS NULL`, it sets `low_stock_enabled_at = now()`. When disabled, the timestamp is preserved (not reset).

**Why trigger instead of app code**: The trigger guarantees correctness regardless of which UI component or API path updates the setting. Both `NotificationSettings.tsx` and `NotificationManagement.tsx` update this table through different flows -- a DB trigger covers all paths with zero app-code changes.

---

## Part B: Outbox Table

**What**: Create `automation_outbox` table for n8n or any external consumer to poll.

**Schema**:
- `id` uuid PK
- `event_type` text NOT NULL
- `business_id` uuid NOT NULL (FK to businesses)
- `product_id` uuid NOT NULL (FK to products)
- `payload` jsonb NOT NULL
- `created_at` timestamptz DEFAULT now()
- `processed_at` timestamptz (NULL = unprocessed)

**Index**: On `(processed_at, created_at)` for efficient polling of unprocessed events.

**RLS Policies**:
- SELECT: Business owners and approved business users can read their own business outbox events
- INSERT: Restricted to `true` (trigger-based inserts run as SECURITY DEFINER context)
- UPDATE: Business owners can mark events as processed
- No DELETE policy (events are kept for audit)

---

## Part C: Crossing-Only Trigger on Products

**What**: A trigger function `enqueue_low_stock_crossing()` on `products` table, firing AFTER UPDATE OF `quantity`.

**Logic** (in order):
1. If `NEW.quantity = OLD.quantity` -- return immediately (no change).
2. Look up `notification_settings` for `NEW.business_id`. If no row exists -- return (automation not configured).
3. Check `low_stock_enabled = true` and `low_stock_enabled_at IS NOT NULL`.
4. Check cutover: `now() >= low_stock_enabled_at`.
5. Resolve threshold: `COALESCE(product_thresholds.low_stock_threshold, notification_settings.low_stock_threshold, 5)`.
6. Check crossing-down: `OLD.quantity > threshold AND NEW.quantity <= threshold`.
7. If all pass -- INSERT into `automation_outbox` with the specified payload structure.

**Trigger**: `trg_enqueue_low_stock_crossing` AFTER UPDATE OF `quantity` ON `products` FOR EACH ROW.

The trigger function uses `SECURITY DEFINER` + `SET search_path = public` (following existing project patterns) so it can read `notification_settings` and `product_thresholds` and write to `automation_outbox` regardless of the calling user's RLS context.

---

## Part D: Frontend Update

**Minimal change**: Update the `useNotificationSettings` query to also select `low_stock_enabled_at` so the UI can display when automation was activated (optional diagnostic info). No other UI changes required -- the trigger handles everything at the DB level.

---

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | All schema changes (A, B, C) in one migration |
| `src/hooks/useNotificationSettings.tsx` | Add `low_stock_enabled_at` to select query |

---

## Created Database Objects

| Object | Type |
|--------|------|
| `notification_settings.low_stock_enabled_at` | Column |
| `set_low_stock_enabled_at()` | Function |
| `trg_set_low_stock_enabled_at` | Trigger on `notification_settings` |
| `automation_outbox` | Table |
| `automation_outbox_unprocessed_idx` | Index |
| `enqueue_low_stock_crossing()` | Function |
| `trg_enqueue_low_stock_crossing` | Trigger on `products` |

---

## Verification Checklist

**Test Case 1 -- Product already below threshold before enable**:
1. Product X has quantity=2, threshold=5.
2. Business enables `low_stock_enabled` (trigger sets `low_stock_enabled_at = now()`).
3. No quantity change occurs on Product X.
4. Result: No row in `automation_outbox`. The trigger only fires on quantity UPDATE, and even if quantity is updated to the same value, `OLD.quantity > threshold` is false (2 is not > 5), so the crossing check fails.

**Test Case 2 -- Product drops below threshold after enable**:
1. Business has `low_stock_enabled = true`, `low_stock_enabled_at = '2026-02-10'`.
2. Product Y has quantity=10, threshold=5.
3. Quantity is updated from 10 to 3.
4. Result: Exactly 1 row in `automation_outbox` with `event_type = 'low_stock_crossed'`, containing old_quantity=10, new_quantity=3, threshold=5.

