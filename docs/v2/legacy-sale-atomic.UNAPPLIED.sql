-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Adds one function for a future legacy sale: the stock change and the
-- inventory_actions row commit together, or neither does.
-- Applying this file does not switch EditProductDialog. That dialog keeps
-- the current two-step write until LEGACY_SALE_ATOMIC_READY is turned on
-- in a deployed client that calls record_legacy_sale.
--
-- The function does not replace execute_inventory_transaction.
-- That RPC only accepts add, remove, and adjust, and a remove row has no
-- salesperson and no idempotency key.
-- It does not call complete_quick_sale. A quick sale stores revenue on
-- sale_lines and leaves sale_total_ils null on the stock row. A legacy sale
-- stores revenue once, on inventory_actions.sale_total_ils.
-- It does not change reverse_inventory_action.
--
-- Order when this is later approved:
--   1. Migration A is already applied (salesperson_employee_id exists).
--   2. Apply this file. Old clients keep the current two-step write.
--      New rows from this function may store a null cost. Existing rows
--      are not updated. There is no service worker to push the new client.
--   3. Deploy the client that calls this function, then set
--      LEGACY_SALE_ATOMIC_READY. A flag alone does not stop old pages.
--   4. Apply docs/v2/legacy-sale-direct-write-guard.UNAPPLIED.sql only after
--      that client is the deployed bundle. The guard is what stops a cached
--      page from decreasing stock and then writing a separate sale row.
--   5. Turn on legacy salesperson attribution only after one active employee
--      exists.
--   6. Only then apply docs/v2/salesperson-required-b.enforcement.sql.
--      Until B, a null salesperson is still stored. After B, a financial
--      insert without an active salesperson fails inside this transaction
--      and the stock change rolls back with it.
--
-- Cost: products.cost null stays null on the new row (unknown). A stored 0
-- stays 0 (a real zero). sale_total_ils stays the VAT-inclusive amount.
-- This file does not divide it and does not change report functions.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'record_legacy_sale requires products and inventory_actions';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL
     OR to_regprocedure('public.can_business_write(uuid)') IS NULL THEN
    RAISE EXCEPTION 'record_legacy_sale requires the current business access checks';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'salesperson_employee_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'apply salesperson-required-a.additive.sql first';
  END IF;
END;
$preconditions$;

-- The column is already nullable. check_sale_data still rejects a sale row
-- whose cost snapshot is null. Drop that requirement for new rows only.
-- NOT VALID does not scan or rewrite historical rows. A stored 0 is unchanged
-- and remains a real zero on rows this function writes.
ALTER TABLE public.inventory_actions DROP CONSTRAINT IF EXISTS check_sale_data;
ALTER TABLE public.inventory_actions
  ADD CONSTRAINT check_sale_data CHECK (
    action_type IS DISTINCT FROM 'sale'
    OR sale_total_ils IS NOT NULL
    OR reference_type = 'sale_transaction'
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_actions_legacy_sale_request
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'legacy_sale_request' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_legacy_sale(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_sale_total_ils numeric,
  p_idempotency_key uuid,
  p_notes text DEFAULT NULL,
  p_salesperson_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_quantity integer;
  v_price numeric;
  v_cost numeric;
  v_list_total numeric;
  v_discount numeric;
  v_discount_percent numeric;
  v_active boolean;
  v_action_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_product_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid legacy sale';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;
  IF p_sale_total_ils IS NULL OR p_sale_total_ils <= 0 THEN
    RAISE EXCEPTION 'invalid sale total';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'notes are too long';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  -- Same key is the same sale. A changed quantity or product needs a new key.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':legacy-sale:' || p_idempotency_key::text, 0)
  );

  SELECT id INTO v_existing
  FROM public.inventory_actions
  WHERE business_id = p_business_id
    AND reference_type = 'legacy_sale_request'
    AND reference_id = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    SELECT quantity INTO v_quantity
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object(
      'action_id', v_existing,
      'replayed', true,
      'product_id', p_product_id,
      'new_quantity', v_quantity
    );
  END IF;

  -- An id is checked whenever the client sends one. Null stays allowed until
  -- migration B. The signed-in user is never stored as the salesperson.
  IF p_salesperson_employee_id IS NOT NULL THEN
    SELECT e.is_active INTO v_active
    FROM public.employees e
    WHERE e.id = p_salesperson_employee_id
      AND e.business_id = p_business_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'salesperson must be an active employee of this business'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- A missing catalog price stays null. It is not stored as 0 and it does
  -- not create a discount. Cost is not coerced: null stays unknown, and 0
  -- stays a real zero.
  SELECT quantity, price, cost
  INTO v_quantity, v_price, v_cost
  FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;
  IF COALESCE(v_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
  END IF;

  IF v_price IS NULL THEN
    v_list_total := NULL;
    v_discount := NULL;
    v_discount_percent := NULL;
  ELSE
    v_list_total := v_price * p_quantity;
    v_discount := v_list_total - p_sale_total_ils;
    IF v_discount > 0 AND v_list_total > 0 THEN
      v_discount_percent := (v_discount / v_list_total) * 100;
    ELSE
      v_discount := 0;
      v_discount_percent := 0;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      sale_total_ils, sale_unit_ils, list_unit_ils, cost_snapshot_ils,
      discount_ils, discount_percent, notes, timestamp,
      salesperson_employee_id, source, reference_type, reference_id, is_reversal
    ) VALUES (
      p_business_id, v_uid, p_product_id, 'sale', -p_quantity, 'ILS',
      p_sale_total_ils, p_sale_total_ils / p_quantity, v_price, v_cost,
      v_discount, v_discount_percent,
      COALESCE(NULLIF(btrim(p_notes), ''), 'מכירה של ' || p_quantity::text || ' יחידות'),
      now(),
      p_salesperson_employee_id, 'legacy_sale', 'legacy_sale_request', p_idempotency_key, false
    )
    RETURNING id INTO v_action_id;

    UPDATE public.products
    SET quantity = COALESCE(quantity, 0) - p_quantity,
        updated_at = now()
    WHERE id = p_product_id
      AND business_id = p_business_id
      AND COALESCE(quantity, 0) >= p_quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.inventory_actions
    WHERE business_id = p_business_id
      AND reference_type = 'legacy_sale_request'
      AND reference_id = p_idempotency_key;
    IF v_existing IS NULL THEN
      RAISE;
    END IF;
    SELECT quantity INTO v_quantity
    FROM public.products
    WHERE id = p_product_id AND business_id = p_business_id;
    RETURN jsonb_build_object(
      'action_id', v_existing,
      'replayed', true,
      'product_id', p_product_id,
      'new_quantity', v_quantity
    );
  END;

  RETURN jsonb_build_object(
    'action_id', v_action_id,
    'replayed', false,
    'product_id', p_product_id,
    'new_quantity', COALESCE(v_quantity, 0) - p_quantity
  );
END;
$record$;

REVOKE ALL ON FUNCTION public.record_legacy_sale(uuid, uuid, integer, numeric, uuid, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legacy_sale(uuid, uuid, integer, numeric, uuid, text, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.record_legacy_sale(uuid, uuid, integer, numeric, uuid, text, uuid) IS
  'One legacy sale. Stock and the inventory_actions sale row commit together. The same idempotency key does not deduct again. sale_total_ils is the VAT-inclusive amount. cost_snapshot_ils is null when product cost is null, and 0 only when product cost is 0. Not deployed until this file is explicitly applied.';

COMMIT;
