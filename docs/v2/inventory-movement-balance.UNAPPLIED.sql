-- UNAPPLIED. DO NOT EXECUTE.
-- Not in supabase/migrations.
--
-- Historical inventory_actions rows do not store stock before or stock after.
-- Reconstructing those balances for one page needs a window over every
-- earlier row of the same product. The journal therefore shows the balance
-- as unavailable instead of guessing from the current quantity.
-- New lifecycle movements, once docs/v2/inventory-lifecycle.UNAPPLIED.sql is
-- applied, store both numbers on that new row only. This file must not be
-- used to backfill older rows.
--
-- A later approved read-only function may compute:
--   sum(quantity_changed) OVER (
--     PARTITION BY business_id, product_id
--     ORDER BY timestamp, id
--     ROWS UNBOUNDED PRECEDING
--   )
-- Do not add a second movement table to fill the screen.

BEGIN;
DO $$
BEGIN
  RAISE EXCEPTION 'inventory movement balance helper is not approved for execution';
END $$;
ROLLBACK;
