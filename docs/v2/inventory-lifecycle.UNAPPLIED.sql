-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- record_supplier_return is not the supplier-return dispatch path.
-- Do not apply it together with confirm_supplier_return_dispatch.
-- That newer function is the only stock exit for /procurement/returns.
--
-- One ledger: public.inventory_actions. No second movement table.
-- Import orders are not receipts. This file does not receive an import order.
-- No payment refund, supplier credit, or settlement row is created.
-- Existing rows are not updated and their balances are not reconstructed.
-- New rows store stock_before and stock_after inside reference_meta, which
-- already exists. A row without those keys stays unavailable in the journal.
--
-- execute_inventory_transaction 'add' requires a unit cost and has no
-- idempotency key, so a purchase with an unknown cost cannot use it.
-- 'adjust' remains available. These functions add idempotency, a stored
-- balance, and an explicit reason where that contract is missing.
--
-- A full sale reversal stays on reverse_inventory_action or reverse_quick_sale.
-- record_customer_return does not set reversed_at and does not refund money.
-- Do not full-reverse an action that already has a customer return: the
-- existing reversal restores the original quantity and does not see the return.
--
-- The direct-write guard, when later applied, blocks a browser quantity
-- decrease. These functions are SECURITY DEFINER and remain able to change
-- stock. Apply this file before inviting any client to call them.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL
     OR to_regclass('public.suppliers') IS NULL THEN
    RAISE EXCEPTION 'inventory lifecycle requires products, inventory_actions, and suppliers';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL
     OR to_regprocedure('public.can_business_write(uuid)') IS NULL THEN
    RAISE EXCEPTION 'inventory lifecycle requires the current business access checks';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'reference_meta' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'inventory_actions.reference_meta is required for stored balances';
  END IF;
END;
$preconditions$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_actions_purchase_receipt
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'purchase_receipt' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_actions_stock_adjustment
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'stock_adjustment' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_actions_supplier_return
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'supplier_return' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_actions_customer_return
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'customer_return' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_purchase_receipt(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_unit_cost numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $purchase$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_quantity integer;
  v_cost numeric;
  v_new_cost numeric;
  v_action_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_product_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid purchase receipt';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN RAISE EXCEPTION 'invalid purchase cost'; END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN RAISE EXCEPTION 'notes are too long'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = p_supplier_id AND s.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'supplier not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':purchase:' || p_idempotency_key::text, 0));
  SELECT id INTO v_existing FROM public.inventory_actions
  WHERE business_id = p_business_id AND reference_type = 'purchase_receipt' AND reference_id = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END IF;

  SELECT quantity, cost INTO v_quantity, v_cost
  FROM public.products WHERE id = p_product_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;

  -- Unknown receipt cost stays null. A known 0 stays 0.
  -- An unknown product cost is not blended with zero while older units remain.
  IF p_unit_cost IS NULL THEN
    v_new_cost := v_cost;
  ELSIF v_cost IS NULL AND COALESCE(v_quantity, 0) > 0 THEN
    v_new_cost := NULL;
  ELSE
    v_new_cost := ((COALESCE(v_quantity, 0) * COALESCE(v_cost, 0)) + (p_quantity * p_unit_cost))
      / (COALESCE(v_quantity, 0) + p_quantity);
  END IF;

  BEGIN
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      purchase_unit_ils, purchase_total_ils, supplier_id, notes, timestamp,
      source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, p_product_id, 'purchase', p_quantity, 'ILS',
      p_unit_cost, CASE WHEN p_unit_cost IS NULL THEN NULL ELSE p_unit_cost * p_quantity END,
      p_supplier_id,
      COALESCE(NULLIF(btrim(p_notes), ''), 'קליטת רכש של ' || p_quantity::text || ' יחידות'),
      now(), 'purchase_receipt', 'purchase_receipt', p_idempotency_key, false,
      jsonb_build_object('stock_before', COALESCE(v_quantity, 0), 'stock_after', COALESCE(v_quantity, 0) + p_quantity)
    ) RETURNING id INTO v_action_id;

    UPDATE public.products
    SET quantity = COALESCE(quantity, 0) + p_quantity, cost = v_new_cost, updated_at = now()
    WHERE id = p_product_id AND business_id = p_business_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.inventory_actions
    WHERE business_id = p_business_id AND reference_type = 'purchase_receipt' AND reference_id = p_idempotency_key;
    IF v_existing IS NULL THEN RAISE; END IF;
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END;

  RETURN jsonb_build_object('action_id', v_action_id, 'replayed', false, 'new_quantity', COALESCE(v_quantity, 0) + p_quantity);
END;
$purchase$;

CREATE OR REPLACE FUNCTION public.record_stock_adjustment(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity_changed integer,
  p_idempotency_key uuid,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $adjust$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_quantity integer;
  v_action_id uuid;
  v_reason text := btrim(p_reason);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_product_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid stock adjustment';
  END IF;
  IF p_quantity_changed IS NULL OR p_quantity_changed = 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF v_reason IS NULL OR length(v_reason) < 1 OR length(v_reason) > 200 THEN RAISE EXCEPTION 'adjustment reason is required'; END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN RAISE EXCEPTION 'notes are too long'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':adjust:' || p_idempotency_key::text, 0));
  SELECT id INTO v_existing FROM public.inventory_actions
  WHERE business_id = p_business_id AND reference_type = 'stock_adjustment' AND reference_id = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END IF;

  SELECT quantity INTO v_quantity FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF COALESCE(v_quantity, 0) + p_quantity_changed < 0 THEN
    RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
  END IF;

  BEGIN
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      notes, timestamp, source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, p_product_id, 'adjust', p_quantity_changed, 'ILS',
      v_reason || CASE WHEN NULLIF(btrim(COALESCE(p_notes, '')), '') IS NULL THEN '' ELSE ' · ' || btrim(p_notes) END,
      now(), 'stock_adjustment', 'stock_adjustment', p_idempotency_key, false,
      jsonb_build_object(
        'stock_before', COALESCE(v_quantity, 0),
        'stock_after', COALESCE(v_quantity, 0) + p_quantity_changed,
        'reason', v_reason
      )
    ) RETURNING id INTO v_action_id;

    UPDATE public.products
    SET quantity = COALESCE(quantity, 0) + p_quantity_changed, updated_at = now()
    WHERE id = p_product_id AND business_id = p_business_id
      AND COALESCE(quantity, 0) + p_quantity_changed >= 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514'; END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.inventory_actions
    WHERE business_id = p_business_id AND reference_type = 'stock_adjustment' AND reference_id = p_idempotency_key;
    IF v_existing IS NULL THEN RAISE; END IF;
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END;

  RETURN jsonb_build_object('action_id', v_action_id, 'replayed', false, 'new_quantity', COALESCE(v_quantity, 0) + p_quantity_changed);
END;
$adjust$;

CREATE OR REPLACE FUNCTION public.record_supplier_return(
  p_business_id uuid,
  p_product_id uuid,
  p_supplier_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $supplier_return$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_quantity integer;
  v_action_id uuid;
  v_reason text := btrim(p_reason);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_product_id IS NULL OR p_supplier_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid supplier return';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF v_reason IS NULL OR length(v_reason) < 1 OR length(v_reason) > 200 THEN RAISE EXCEPTION 'return reason is required'; END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN RAISE EXCEPTION 'notes are too long'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = p_supplier_id AND s.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'supplier not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':supplier-return:' || p_idempotency_key::text, 0));
  SELECT id INTO v_existing FROM public.inventory_actions
  WHERE business_id = p_business_id AND reference_type = 'supplier_return' AND reference_id = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END IF;

  SELECT quantity INTO v_quantity FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  IF COALESCE(v_quantity, 0) < p_quantity THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514'; END IF;

  BEGIN
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      supplier_id, notes, timestamp, source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, p_product_id, 'return', -p_quantity, 'ILS',
      p_supplier_id,
      v_reason || CASE WHEN NULLIF(btrim(COALESCE(p_notes, '')), '') IS NULL THEN '' ELSE ' · ' || btrim(p_notes) END,
      now(), 'supplier_return', 'supplier_return', p_idempotency_key, false,
      jsonb_build_object(
        'stock_before', COALESCE(v_quantity, 0),
        'stock_after', COALESCE(v_quantity, 0) - p_quantity,
        'reason', v_reason,
        'units', p_quantity,
        'financial_credit', false
      )
    ) RETURNING id INTO v_action_id;

    UPDATE public.products
    SET quantity = COALESCE(quantity, 0) - p_quantity, updated_at = now()
    WHERE id = p_product_id AND business_id = p_business_id AND COALESCE(quantity, 0) >= p_quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514'; END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.inventory_actions
    WHERE business_id = p_business_id AND reference_type = 'supplier_return' AND reference_id = p_idempotency_key;
    IF v_existing IS NULL THEN RAISE; END IF;
    SELECT quantity INTO v_quantity FROM public.products WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END;

  RETURN jsonb_build_object('action_id', v_action_id, 'replayed', false, 'new_quantity', COALESCE(v_quantity, 0) - p_quantity);
END;
$supplier_return$;

CREATE OR REPLACE FUNCTION public.record_customer_return(
  p_business_id uuid,
  p_original_action_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_disposition text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $customer_return$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_original record;
  v_returned integer;
  v_quantity integer;
  v_delta integer;
  v_action_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_original_action_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid customer return';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF p_disposition NOT IN ('restock', 'damaged') THEN RAISE EXCEPTION 'invalid return disposition'; END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN RAISE EXCEPTION 'notes are too long'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':customer-return:' || p_idempotency_key::text, 0));
  SELECT id INTO v_existing FROM public.inventory_actions
  WHERE business_id = p_business_id AND reference_type = 'customer_return' AND reference_id = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT p.quantity INTO v_quantity
    FROM public.products p
    JOIN public.inventory_actions a ON a.product_id = p.id AND a.business_id = p.business_id
    WHERE a.id = v_existing;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END IF;

  SELECT id, product_id, quantity_changed, sale_total_ils, reference_type, is_reversal, reversed_at
    INTO v_original
  FROM public.inventory_actions
  WHERE id = p_original_action_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sale movement not found'; END IF;
  IF COALESCE(v_original.is_reversal, false) OR v_original.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'sale movement is already reversed';
  END IF;
  IF NOT (
    v_original.sale_total_ils IS NOT NULL
    OR v_original.reference_type = 'sale_transaction'
  ) THEN
    RAISE EXCEPTION 'original movement is not a sale';
  END IF;

  SELECT COALESCE(SUM(COALESCE((reference_meta->>'units')::integer, 0)), 0) INTO v_returned
  FROM public.inventory_actions
  WHERE business_id = p_business_id
    AND reference_type = 'customer_return'
    AND reference_meta->>'original_action_id' = p_original_action_id::text;
  IF v_returned + p_quantity > ABS(v_original.quantity_changed) THEN
    RAISE EXCEPTION 'return exceeds the sold quantity';
  END IF;

  SELECT quantity INTO v_quantity FROM public.products
  WHERE id = v_original.product_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
  v_delta := CASE WHEN p_disposition = 'restock' THEN p_quantity ELSE 0 END;

  BEGIN
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      notes, timestamp, source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, v_original.product_id, 'return', v_delta, 'ILS',
      CASE WHEN p_disposition = 'restock' THEN 'החזרת לקוח למלאי' ELSE 'החזרת לקוח ללא החזרה למלאי' END
        || CASE WHEN NULLIF(btrim(COALESCE(p_notes, '')), '') IS NULL THEN '' ELSE ' · ' || btrim(p_notes) END,
      now(), 'customer_return', 'customer_return', p_idempotency_key, false,
      jsonb_build_object(
        'stock_before', COALESCE(v_quantity, 0),
        'stock_after', COALESCE(v_quantity, 0) + v_delta,
        'original_action_id', p_original_action_id,
        'disposition', p_disposition,
        'units', p_quantity,
        'financial_refund', false
      )
    ) RETURNING id INTO v_action_id;

    IF v_delta <> 0 THEN
      UPDATE public.products
      SET quantity = COALESCE(quantity, 0) + v_delta, updated_at = now()
      WHERE id = v_original.product_id AND business_id = p_business_id;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.inventory_actions
    WHERE business_id = p_business_id AND reference_type = 'customer_return' AND reference_id = p_idempotency_key;
    IF v_existing IS NULL THEN RAISE; END IF;
    SELECT quantity INTO v_quantity FROM public.products
    WHERE id = v_original.product_id AND business_id = p_business_id;
    RETURN jsonb_build_object('action_id', v_existing, 'replayed', true, 'new_quantity', v_quantity);
  END;

  RETURN jsonb_build_object('action_id', v_action_id, 'replayed', false, 'new_quantity', COALESCE(v_quantity, 0) + v_delta);
END;
$customer_return$;

REVOKE ALL ON FUNCTION public.record_purchase_receipt(uuid, uuid, integer, uuid, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_stock_adjustment(uuid, uuid, integer, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_supplier_return(uuid, uuid, uuid, integer, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_customer_return(uuid, uuid, integer, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_purchase_receipt(uuid, uuid, integer, uuid, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_adjustment(uuid, uuid, integer, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_return(uuid, uuid, uuid, integer, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_return(uuid, uuid, integer, uuid, text, text) TO authenticated;

COMMIT;
