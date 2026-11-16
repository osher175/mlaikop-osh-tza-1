-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- One stock exit for /procurement/returns: confirm_supplier_return_dispatch.
-- Do not also apply record_supplier_return from inventory-lifecycle.UNAPPLIED.sql.
--
-- The document is created only when an authorized user confirms physical dispatch.
-- products.quantity decreases once per line, in the same transaction.
-- sale_total_ils, salesperson_employee_id, sale_items and sale_transactions are not written.
-- expected_credit_ils is a snapshot of returned-goods value. credit_status starts at
-- not_recorded. This file does not post a payment, refund, revenue or credit receipt.
--
-- Decreasing products.quantity can still wake the existing low-stock notification
-- trigger and trg_procurement_on_stock_change. Those are not a second deduction.
-- This file does not disable or replace them.
--
-- Rollback, only before any return has been confirmed: drop the function, then
-- supplier_return_lines, then supplier_returns. Do not delete inventory_actions
-- that a confirmed return already wrote.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.suppliers') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'supplier return dispatch requires products, suppliers, and inventory_actions';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL
     OR to_regprocedure('public.can_business_write(uuid)') IS NULL THEN
    RAISE EXCEPTION 'supplier return dispatch requires the current business access checks';
  END IF;
  IF to_regclass('public.supplier_returns') IS NOT NULL
     OR to_regclass('public.supplier_return_lines') IS NOT NULL
     OR to_regprocedure('public.confirm_supplier_return_dispatch(uuid,uuid,text,text,jsonb,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'supplier return dispatch objects already exist';
  END IF;
END;
$preconditions$;

CREATE TABLE public.supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  return_number text NOT NULL,
  reason text NOT NULL,
  notes text,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  confirmed_by uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  payload jsonb NOT NULL,
  expected_credit_ils numeric(14,2),
  credit_status text NOT NULL DEFAULT 'not_recorded',
  CONSTRAINT supplier_returns_reason_check CHECK (reason IN ('defect', 'wrong_product', 'agreement', 'other')),
  CONSTRAINT supplier_returns_credit_status_check CHECK (credit_status IN ('not_recorded', 'pending', 'received')),
  CONSTRAINT supplier_returns_expected_credit_check CHECK (expected_credit_ils IS NULL OR expected_credit_ils >= 0),
  CONSTRAINT supplier_returns_number_key UNIQUE (business_id, return_number),
  CONSTRAINT supplier_returns_idempotency_key UNIQUE (business_id, idempotency_key)
);

CREATE TABLE public.supplier_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.supplier_returns(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit_cost_ils numeric(14,2),
  line_total_ils numeric(14,2),
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  inventory_action_id uuid NOT NULL REFERENCES public.inventory_actions(id),
  CONSTRAINT supplier_return_lines_quantity_check CHECK (quantity > 0),
  CONSTRAINT supplier_return_lines_cost_check CHECK (unit_cost_ils IS NULL OR unit_cost_ils >= 0),
  CONSTRAINT supplier_return_lines_total_check CHECK (
    (unit_cost_ils IS NULL AND line_total_ils IS NULL)
    OR (unit_cost_ils IS NOT NULL AND line_total_ils = round(unit_cost_ils * quantity, 2))
  ),
  CONSTRAINT supplier_return_lines_stock_check CHECK (stock_after = stock_before - quantity AND stock_after >= 0),
  CONSTRAINT supplier_return_lines_product_key UNIQUE (return_id, product_id)
);

ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_return_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_returns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.supplier_return_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supplier_returns TO authenticated;
GRANT SELECT ON public.supplier_return_lines TO authenticated;

CREATE POLICY supplier_returns_member_read ON public.supplier_returns
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
CREATE POLICY supplier_return_lines_member_read ON public.supplier_return_lines
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.confirm_supplier_return_dispatch(
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
AS $dispatch$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(p_reason);
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_raw jsonb;
  v_product uuid;
  v_quantity integer;
  v_cost numeric(14,2);
  v_cost_text text;
  v_sorted jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_existing jsonb;
  v_return_id uuid;
  v_number text;
  v_seq integer;
  v_before integer;
  v_after integer;
  v_action_id uuid;
  v_line_id uuid;
  v_expected numeric(14,2) := 0;
  v_expected_known boolean := true;
  v_movements jsonb := '[]'::jsonb;
  v_count integer;
  v_distinct integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_business_id IS NULL OR p_supplier_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid supplier return';
  END IF;
  IF v_reason IS NULL OR v_reason NOT IN ('defect', 'wrong_product', 'agreement', 'other') THEN
    RAISE EXCEPTION 'return reason is required';
  END IF;
  IF v_notes IS NOT NULL AND length(v_notes) > 2000 THEN RAISE EXCEPTION 'notes are too long'; END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 100 THEN
    RAISE EXCEPTION 'invalid supplier return';
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
      RAISE EXCEPTION 'invalid supplier return';
    END;
    v_cost_text := v_raw->>'quantity';
    IF v_product IS NULL OR v_cost_text IS NULL OR v_cost_text !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;
    v_quantity := v_cost_text::integer;
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
    'business_id', p_business_id,
    'supplier_id', p_supplier_id,
    'reason', v_reason,
    'notes', COALESCE(v_notes, ''),
    'lines', v_sorted
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':supplier-return-dispatch:' || p_idempotency_key::text, 0));
  SELECT payload INTO v_existing FROM public.supplier_returns
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'idempotency key reused with a different supplier return';
    END IF;
    RETURN (
      SELECT jsonb_build_object(
        'return_id', r.id,
        'return_number', r.return_number,
        'replayed', true,
        'credit_status', r.credit_status,
        'expected_credit_ils', r.expected_credit_ils,
        'movement_ids', COALESCE(jsonb_agg(l.inventory_action_id), '[]'::jsonb)
      )
      FROM public.supplier_returns r
      JOIN public.supplier_return_lines l ON l.return_id = r.id
      WHERE r.business_id = p_business_id AND r.idempotency_key = p_idempotency_key
      GROUP BY r.id, r.return_number, r.credit_status, r.expected_credit_ils
    );
  END IF;

  PERFORM p.id FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.id IN (SELECT (elem->>'product_id')::uuid FROM jsonb_array_elements(v_sorted) elem)
  ORDER BY p.id
  FOR UPDATE;
  IF (
    SELECT COUNT(*) FROM public.products p
    WHERE p.business_id = p_business_id
      AND p.id IN (SELECT (elem->>'product_id')::uuid FROM jsonb_array_elements(v_sorted) elem)
  ) <> v_count THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  SELECT COUNT(*) + 1 INTO v_seq FROM public.supplier_returns WHERE business_id = p_business_id;
  v_number := 'SR-' || to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY') || '-' || lpad(v_seq::text, 4, '0');
  INSERT INTO public.supplier_returns (
    business_id, supplier_id, return_number, reason, notes, created_by, confirmed_by,
    idempotency_key, payload, expected_credit_ils, credit_status
  ) VALUES (
    p_business_id, p_supplier_id, v_number, v_reason, v_notes, v_uid, v_uid,
    p_idempotency_key, v_payload, NULL, 'not_recorded'
  ) RETURNING id INTO v_return_id;

  FOR v_raw IN SELECT value FROM jsonb_array_elements(v_sorted) LOOP
    v_product := (v_raw->>'product_id')::uuid;
    v_quantity := (v_raw->>'quantity')::integer;
    v_cost := CASE WHEN jsonb_typeof(v_raw->'unit_cost') = 'null' THEN NULL ELSE (v_raw->>'unit_cost')::numeric END;
    SELECT quantity INTO v_before FROM public.products
    WHERE id = v_product AND business_id = p_business_id;
    IF v_before IS NULL OR v_before < v_quantity THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;
    v_line_id := gen_random_uuid();
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      supplier_id, cost_snapshot_ils, sale_total_ils, sale_unit_ils, salesperson_employee_id,
      purchase_unit_ils, purchase_total_ils, notes, timestamp, source, reference_type, reference_id,
      is_reversal, reference_meta
    ) VALUES (
      p_business_id, v_uid, v_product, 'return', -v_quantity, 'ILS',
      p_supplier_id, v_cost, NULL, NULL, NULL,
      NULL, NULL,
      v_reason || CASE WHEN v_notes IS NULL THEN '' ELSE ' · ' || v_notes END,
      now(), 'supplier_return_dispatch', 'supplier_return', v_line_id,
      false,
      jsonb_build_object(
        'return_id', v_return_id,
        'return_number', v_number,
        'stock_before', v_before,
        'stock_after', v_before - v_quantity,
        'units', v_quantity,
        'unit_cost', v_cost,
        'financial_credit', false,
        'credit_status', 'not_recorded'
      )
    ) RETURNING id INTO v_action_id;

    UPDATE public.products
    SET quantity = quantity - v_quantity, updated_at = now()
    WHERE id = v_product AND business_id = p_business_id AND quantity >= v_quantity
    RETURNING quantity INTO v_after;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514'; END IF;

    INSERT INTO public.supplier_return_lines (
      id, return_id, business_id, product_id, quantity, unit_cost_ils, line_total_ils,
      stock_before, stock_after, inventory_action_id
    ) VALUES (
      v_line_id, v_return_id, p_business_id, v_product, v_quantity, v_cost,
      CASE WHEN v_cost IS NULL THEN NULL ELSE round(v_cost * v_quantity, 2) END,
      v_before, v_after, v_action_id
    );
    IF v_cost IS NULL THEN
      v_expected_known := false;
    ELSE
      v_expected := v_expected + round(v_cost * v_quantity, 2);
    END IF;
    v_movements := v_movements || jsonb_build_array(v_action_id);
  END LOOP;

  UPDATE public.supplier_returns
  SET expected_credit_ils = CASE WHEN v_expected_known THEN v_expected ELSE NULL END
  WHERE id = v_return_id;

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_number,
    'replayed', false,
    'credit_status', 'not_recorded',
    'expected_credit_ils', CASE WHEN v_expected_known THEN v_expected ELSE NULL END,
    'movement_ids', v_movements
  );
END;
$dispatch$;

REVOKE ALL ON FUNCTION public.confirm_supplier_return_dispatch(uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_return_dispatch(uuid, uuid, text, text, jsonb, uuid) TO authenticated;

COMMIT;

-- Isolated checks below are NOT EXECUTED by this file.
-- 1 one product decreases quantity by that amount and writes one supplier_return movement
-- 2 two products write two movements and one document
-- 3 a return of the exact remaining quantity leaves 0
-- 4 a larger quantity raises insufficient stock and leaves quantity unchanged
-- 5 zero, negative and fractional quantities raise invalid quantity
-- 6 a product from another business raises product not found
-- 7 a supplier from another business raises supplier not found
-- 8 a user who is not a writing member raises access denied
-- 9 the same key and payload returns replayed true and does not deduct again
-- 10 the same key with a different quantity or cost raises idempotency key reused
-- 11 two concurrent identical calls produce one document
-- 12 two concurrent different returns of the last unit: one commits, one raises insufficient stock
-- 13 a failing second line rolls back the first line's quantity and movement
-- 14 each line has one inventory_actions row and one supplier_return_lines row
-- 15 no row is inserted into sale_items or sale_transactions, and sale_total_ils stays null
-- 16 the document stores the return number, both user ids, and the movement ids
-- 17 changing products.cost later leaves unit_cost_ils and cost_snapshot_ils unchanged
-- 18 the function itself inserts no notification and no procurement request
