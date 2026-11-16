-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Adds lot tables and an allocator. It does not create a trigger and it does
-- not change complete_quick_sale, record_legacy_sale, or the purchase dialog.
-- Applying this file alone does not value historical stock and does not change
-- the live cost method. Opening quantities stay unknown until a later approved
-- reconciliation. Do not invent receipt dates for stock already on hand.
-- There is no branch or transfer ledger. A transfer exit is rejected.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  received_at timestamptz,
  original_quantity integer NOT NULL CHECK (original_quantity > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0),
  unit_cost_ils numeric(14, 2),
  supplier_id uuid,
  source_type text NOT NULL CHECK (source_type IN (
    'purchase_receipt', 'customer_return_restock', 'adjustment_increase', 'opening_unknown'
  )),
  receipt_reference_type text,
  receipt_reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_quantity <= original_quantity),
  CHECK (source_type <> 'opening_unknown' OR received_at IS NULL)
);

CREATE INDEX IF NOT EXISTS inventory_lots_fifo_idx
  ON public.inventory_lots (business_id, product_id, received_at NULLS LAST, id);

CREATE TABLE IF NOT EXISTS public.inventory_lot_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES public.inventory_lots (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  movement_reference_type text,
  movement_reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key, lot_id)
);

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lot_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_lots_member_read ON public.inventory_lots;
CREATE POLICY inventory_lots_member_read ON public.inventory_lots
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

DROP POLICY IF EXISTS inventory_lot_allocations_member_read ON public.inventory_lot_allocations;
CREATE POLICY inventory_lot_allocations_member_read ON public.inventory_lot_allocations
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.allocate_fifo_exit(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_idempotency_key uuid,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_lot record;
  v_left integer;
  v_take integer;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF p_source = 'transfer' THEN
    RAISE EXCEPTION 'transfers are not supported' USING ERRCODE = '0A000';
  END IF;
  IF p_source NOT IN ('sale', 'supplier_return', 'adjustment_decrease') THEN
    RAISE EXCEPTION 'unsupported stock exit';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':fifo:' || p_idempotency_key::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.inventory_lot_allocations
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key
  ) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', quantity)), '[]'::jsonb)
    INTO v_rows
    FROM public.inventory_lot_allocations
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('replayed', true, 'allocations', v_rows);
  END IF;

  PERFORM id FROM public.inventory_lots
  WHERE business_id = p_business_id AND product_id = p_product_id AND remaining_quantity > 0
  ORDER BY received_at NULLS LAST, id
  FOR UPDATE;

  SELECT COALESCE(SUM(remaining_quantity), 0) INTO v_left
  FROM public.inventory_lots
  WHERE business_id = p_business_id AND product_id = p_product_id AND remaining_quantity > 0;
  IF v_left < p_quantity THEN
    RAISE EXCEPTION 'insufficient lot quantity' USING ERRCODE = '23514';
  END IF;

  v_left := p_quantity;
  FOR v_lot IN
    SELECT id, remaining_quantity, unit_cost_ils
    FROM public.inventory_lots
    WHERE business_id = p_business_id AND product_id = p_product_id AND remaining_quantity > 0
    ORDER BY received_at NULLS LAST, id
  LOOP
    EXIT WHEN v_left = 0;
    v_take := LEAST(v_lot.remaining_quantity, v_left);
    UPDATE public.inventory_lots
    SET remaining_quantity = remaining_quantity - v_take
    WHERE id = v_lot.id AND remaining_quantity >= v_take;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lot changed during allocation' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.inventory_lot_allocations (business_id, idempotency_key, lot_id, quantity)
    VALUES (p_business_id, p_idempotency_key, v_lot.id, v_take);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'lot_id', v_lot.id, 'quantity', v_take, 'unit_cost_ils', v_lot.unit_cost_ils
    ));
    v_left := v_left - v_take;
  END LOOP;

  RETURN jsonb_build_object('replayed', false, 'allocations', v_rows);
END;
$fn$;

REVOKE ALL ON FUNCTION public.allocate_fifo_exit(uuid, uuid, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_fifo_exit(uuid, uuid, integer, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.allocate_fifo_exit(uuid, uuid, integer, uuid, text) IS
  'Consumes lots oldest-first. Unknown-age lots are last. A repeated key does not consume again. Does not change products.quantity and is not called by the live sale path.';

COMMIT;
