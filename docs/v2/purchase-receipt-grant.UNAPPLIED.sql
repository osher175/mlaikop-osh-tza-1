-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute on production.
-- Grants the purchase-order receipt function that purchase-order-receipts creates
-- without an EXECUTE grant. Does not replace that function.
-- Does not grant record_purchase_receipt. A purchase-order receipt and a direct
-- product receipt are different operations and must not both post the same units.
-- Apply only after docs/v2/purchase-order-receipts.UNAPPLIED.sql, and only before
-- the client flag PURCHASE_RECEIPT_ATOMIC_READY is turned on.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regprocedure('public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)') IS NULL THEN
    RAISE EXCEPTION 'apply docs/v2/purchase-order-receipts.UNAPPLIED.sql before this grant';
  END IF;
END;
$preconditions$;

REVOKE ALL ON FUNCTION public.post_purchase_receipt(uuid, uuid, uuid, uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_purchase_receipt(uuid, uuid, uuid, uuid, jsonb, boolean) TO authenticated;

COMMIT;
