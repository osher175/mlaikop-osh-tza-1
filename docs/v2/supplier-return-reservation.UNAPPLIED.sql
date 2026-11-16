-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute.
--
-- Reservation holds units without changing products.quantity.
-- Available stock is products.quantity - products.quantity_reserved.
-- Release puts those units back into available stock and does not change quantity.
-- dispatch_reserved_supplier_return decreases quantity and quantity_reserved
-- by the same amount in one update. That is the only physical deduction on
-- this path. Do not also call record_supplier_return or
-- confirm_supplier_return_dispatch for the same units.
--
-- Apply only after docs/v2/products-quantity-update-lock.PRODUCTION.UNAPPLIED.sql.
-- Table UPDATE is already revoked there, so this new column is not granted to
-- authenticated or anon. Applying this file first would leave quantity_reserved
-- writable by any member who can update products.
--
-- Existing negative quantities are left as they are. The check rejects a
-- reservation above the physical quantity and a later quantity update that
-- would fall below the reserved amount. It does not rewrite old rows.
--
-- Rollback, only before a reservation row exists:
--   DROP FUNCTION public.dispatch_reserved_supplier_return(uuid, uuid);
--   DROP FUNCTION public.release_supplier_return_reservation(uuid, uuid);
--   DROP FUNCTION public.reserve_supplier_return(uuid, uuid, text, text, jsonb, uuid);
--   DROP TABLE public.supplier_return_reservation_lines;
--   DROP TABLE public.supplier_return_reservations;
--   ALTER TABLE public.products DROP CONSTRAINT products_quantity_reserved_within_available;
--   ALTER TABLE public.products DROP COLUMN quantity_reserved;

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.suppliers') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'supplier return reservation requires products, suppliers, and inventory_actions';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL
     OR to_regprocedure('public.can_business_write(uuid)') IS NULL THEN
    RAISE EXCEPTION 'supplier return reservation requires the current business access checks';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'quantity_reserved'
  ) OR to_regclass('public.supplier_return_reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'supplier return reservation objects already exist';
  END IF;
  IF has_table_privilege('authenticated', 'public.products', 'UPDATE')
     OR has_table_privilege('anon', 'public.products', 'UPDATE') THEN
    RAISE EXCEPTION 'apply the production quantity lock before supplier return reservation';
  END IF;
END;
$preconditions$;

ALTER TABLE public.products
  ADD COLUMN quantity_reserved integer NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_reserved_within_available
  CHECK (quantity_reserved >= 0 AND quantity_reserved <= GREATEST(quantity, 0));

REVOKE UPDATE (quantity_reserved) ON public.products FROM PUBLIC, anon, authenticated;

CREATE TABLE public.supplier_return_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'reserved',
  idempotency_key uuid NOT NULL,
  payload jsonb NOT NULL,
  created_by uuid NOT NULL,
  movement_ids jsonb,
  CONSTRAINT supplier_return_reservations_status_check CHECK (status IN ('reserved', 'released', 'dispatched')),
  CONSTRAINT supplier_return_reservations_reason_check CHECK (reason IN ('defect', 'wrong_product', 'agreement', 'other')),
  CONSTRAINT supplier_return_reservations_idempotency_key UNIQUE (business_id, idempotency_key)
);

CREATE TABLE public.supplier_return_reservation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.supplier_return_reservations(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit_cost_ils numeric(14,2),
  CONSTRAINT supplier_return_reservation_lines_quantity_check CHECK (quantity > 0),
  CONSTRAINT supplier_return_reservation_lines_cost_check CHECK (unit_cost_ils IS NULL OR unit_cost_ils >= 0),
  CONSTRAINT supplier_return_reservation_lines_product_key UNIQUE (reservation_id, product_id)
);

ALTER TABLE public.supplier_return_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_return_reservation_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_return_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.supplier_return_reservation_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supplier_return_reservations TO authenticated;
GRANT SELECT ON public.supplier_return_reservation_lines TO authenticated;

CREATE POLICY supplier_return_reservations_member_read ON public.supplier_return_reservations
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
CREATE POLICY supplier_return_reservation_lines_member_read ON public.supplier_return_reservation_lines
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.reserve_supplier_return(
  p_business_id uuid,
  p_supplier_id uuid,
  p_reason text,
  p_notes text,
  p_lines jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $reserve$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(p_reason);
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_raw jsonb;
  v_product uuid;
  v_quantity integer;
  v_cost numeric(14,2);
  v_sorted jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_existing jsonb;
  v_reservation uuid;
  v_count integer;
  v_distinct integer;
  v_before integer;
  v_reserved integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_supplier_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid supplier return reservation';
  END IF;
  IF v_reason IS NULL OR v_reason NOT IN ('defect', 'wrong_product', 'agreement', 'other') THEN
    RAISE EXCEPTION 'return reason is required';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 100 THEN
    RAISE EXCEPTION 'invalid supplier return reservation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = p_supplier_id AND s.business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'supplier not found';
  END IF;

  FOR v_raw IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    BEGIN
      v_product := (v_raw->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid supplier return reservation';
    END;
    IF v_product IS NULL OR (v_raw->>'quantity') !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;
    v_quantity := (v_raw->>'quantity')::integer;
    IF v_quantity > 100000 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    IF jsonb_typeof(v_raw->'unit_cost') IS NULL OR jsonb_typeof(v_raw->'unit_cost') = 'null' THEN
      v_cost := NULL;
    ELSIF jsonb_typeof(v_raw->'unit_cost') <> 'number' THEN
      RAISE EXCEPTION 'invalid unit cost';
    ELSE
      v_cost := (v_raw->>'unit_cost')::numeric;
      IF v_cost < 0 OR v_cost <> round(v_cost, 2) THEN RAISE EXCEPTION 'invalid unit cost'; END IF;
    END IF;
    v_sorted := v_sorted || jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'quantity', v_quantity, 'unit_cost', v_cost
    ));
  END LOOP;

  SELECT COUNT(*), COUNT(DISTINCT elem->>'product_id') INTO v_count, v_distinct
  FROM jsonb_array_elements(v_sorted) elem;
  IF v_count <> v_distinct THEN RAISE EXCEPTION 'duplicate product on supplier return'; END IF;
  SELECT COALESCE(jsonb_agg(elem ORDER BY elem->>'product_id'), '[]'::jsonb) INTO v_sorted
  FROM jsonb_array_elements(v_sorted) elem;
  v_payload := jsonb_build_object(
    'business_id', p_business_id, 'supplier_id', p_supplier_id,
    'reason', v_reason, 'notes', COALESCE(v_notes, ''), 'lines', v_sorted
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':supplier-return-reservation:' || p_idempotency_key::text, 0));
  SELECT payload, id INTO v_existing, v_reservation
  FROM public.supplier_return_reservations
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'idempotency key reused with a different supplier return';
    END IF;
    RETURN jsonb_build_object('reservation_id', v_reservation, 'replayed', true, 'quantity_changed', false);
  END IF;

  PERFORM p.id FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.id IN (SELECT (elem->>'product_id')::uuid FROM jsonb_array_elements(v_sorted) elem)
  ORDER BY p.id
  FOR UPDATE;

  INSERT INTO public.supplier_return_reservations (
    business_id, supplier_id, reason, notes, status, idempotency_key, payload, created_by
  ) VALUES (
    p_business_id, p_supplier_id, v_reason, v_notes, 'reserved', p_idempotency_key, v_payload, v_uid
  ) RETURNING id INTO v_reservation;

  FOR v_raw IN SELECT value FROM jsonb_array_elements(v_sorted) LOOP
    v_product := (v_raw->>'product_id')::uuid;
    v_quantity := (v_raw->>'quantity')::integer;
    v_cost := CASE WHEN jsonb_typeof(v_raw->'unit_cost') = 'null' THEN NULL ELSE (v_raw->>'unit_cost')::numeric END;
    UPDATE public.products
    SET quantity_reserved = quantity_reserved + v_quantity, updated_at = now()
    WHERE id = v_product
      AND business_id = p_business_id
      AND quantity - quantity_reserved >= v_quantity
    RETURNING quantity, quantity_reserved INTO v_before, v_reserved;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient available stock' USING ERRCODE = '23514'; END IF;
    INSERT INTO public.supplier_return_reservation_lines (
      reservation_id, business_id, product_id, quantity, unit_cost_ils
    ) VALUES (
      v_reservation, p_business_id, v_product, v_quantity, v_cost
    );
  END LOOP;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation,
    'replayed', false,
    'quantity_changed', false,
    'physical_quantity', v_before,
    'quantity_reserved', v_reserved
  );
END;
$reserve$;

CREATE OR REPLACE FUNCTION public.release_supplier_return_reservation(
  p_business_id uuid,
  p_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $release$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_line record;
  v_quantity integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reservation_id::text, 0));
  SELECT status INTO v_status
  FROM public.supplier_return_reservations
  WHERE id = p_reservation_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;
  IF v_status = 'released' THEN
    RETURN jsonb_build_object('reservation_id', p_reservation_id, 'replayed', true, 'quantity_changed', false);
  END IF;
  IF v_status <> 'reserved' THEN RAISE EXCEPTION 'reservation cannot be released'; END IF;

  FOR v_line IN
    SELECT product_id, quantity
    FROM public.supplier_return_reservation_lines
    WHERE reservation_id = p_reservation_id AND business_id = p_business_id
    ORDER BY product_id
  LOOP
    UPDATE public.products
    SET quantity_reserved = quantity_reserved - v_line.quantity, updated_at = now()
    WHERE id = v_line.product_id
      AND business_id = p_business_id
      AND quantity_reserved >= v_line.quantity
    RETURNING quantity INTO v_quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'reservation is no longer held'; END IF;
  END LOOP;

  UPDATE public.supplier_return_reservations
  SET status = 'released'
  WHERE id = p_reservation_id AND business_id = p_business_id AND status = 'reserved';
  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'replayed', false, 'quantity_changed', false, 'physical_quantity', v_quantity);
END;
$release$;

CREATE OR REPLACE FUNCTION public.dispatch_reserved_supplier_return(
  p_business_id uuid,
  p_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $dispatch_reserved$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_movements jsonb;
  v_line record;
  v_before integer;
  v_after integer;
  v_action uuid;
  v_ids jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_reservation_id::text, 0));
  SELECT status, movement_ids INTO v_status, v_movements
  FROM public.supplier_return_reservations
  WHERE id = p_reservation_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;
  IF v_status = 'dispatched' THEN
    RETURN jsonb_build_object('reservation_id', p_reservation_id, 'replayed', true, 'movement_ids', COALESCE(v_movements, '[]'::jsonb));
  END IF;
  IF v_status <> 'reserved' THEN RAISE EXCEPTION 'reservation cannot be dispatched'; END IF;

  PERFORM p.id FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.id IN (
      SELECT product_id FROM public.supplier_return_reservation_lines
      WHERE reservation_id = p_reservation_id AND business_id = p_business_id
    )
  ORDER BY p.id
  FOR UPDATE;

  FOR v_line IN
    SELECT id, product_id, quantity, unit_cost_ils
    FROM public.supplier_return_reservation_lines
    WHERE reservation_id = p_reservation_id AND business_id = p_business_id
    ORDER BY product_id
  LOOP
    SELECT quantity INTO v_before
    FROM public.products
    WHERE id = v_line.product_id AND business_id = p_business_id;
    UPDATE public.products
    SET quantity = quantity - v_line.quantity,
        quantity_reserved = quantity_reserved - v_line.quantity,
        updated_at = now()
    WHERE id = v_line.product_id
      AND business_id = p_business_id
      AND quantity >= v_line.quantity
      AND quantity_reserved >= v_line.quantity
    RETURNING quantity INTO v_after;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514'; END IF;

    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      cost_snapshot_ils, notes, timestamp, source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, v_line.product_id, 'return', -v_line.quantity, 'ILS',
      v_line.unit_cost_ils, 'supplier return dispatch', now(),
      'supplier_return_reservation', 'supplier_return_reservation', v_line.id, false,
      jsonb_build_object(
        'reservation_id', p_reservation_id,
        'stock_before', v_before,
        'stock_after', v_after,
        'units', v_line.quantity,
        'financial_credit', false
      )
    ) RETURNING id INTO v_action;
    v_ids := v_ids || jsonb_build_array(v_action);
  END LOOP;

  UPDATE public.supplier_return_reservations
  SET status = 'dispatched', movement_ids = v_ids
  WHERE id = p_reservation_id AND business_id = p_business_id AND status = 'reserved';
  RETURN jsonb_build_object('reservation_id', p_reservation_id, 'replayed', false, 'movement_ids', v_ids);
END;
$dispatch_reserved$;

REVOKE ALL ON FUNCTION public.reserve_supplier_return(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_supplier_return(uuid, uuid, text, text, jsonb, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.release_supplier_return_reservation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_supplier_return_reservation(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.dispatch_reserved_supplier_return(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_reserved_supplier_return(uuid, uuid) TO authenticated;

COMMIT;
