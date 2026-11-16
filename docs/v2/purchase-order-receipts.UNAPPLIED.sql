-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
-- This file replaces the earlier draft of the same name. It was never applied.
--
-- Apply only after the employees table already present in production.
-- inventory_lots is not required to save a draft or a confirmed order.
-- It is required before EXECUTE is granted on post_purchase_receipt.
-- That grant is withheld here. Physical receiving stays inactive.
-- Do not also call record_purchase_receipt for the same physical receipt.
--
-- A purchase order does not change products.quantity.
-- A draft is not an agreed supplier order and does not contact the supplier.
-- Confirmation records an order already agreed. It does not change stock,
-- does not create a FIFO lot, and does not create an inventory movement.
-- Null purchase cost stays null. Zero stays zero.
-- Amounts are the agreed purchase prices. VAT is not added or removed.
-- The VAT basis of supplier prices is undefined, so these amounts must not
-- be used for inventory valuation or gross profit until that basis is decided.
-- The browser has no insert, update, delete, or truncate privilege on these tables.
-- save_purchase_order requires a signed-in member of that business and an
-- active or trial billing status. can_business_write checks billing only.
-- is_business_member is called with auth.uid(), which the client cannot replace.
-- post_purchase_receipt is created without an execute grant.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.suppliers') IS NULL
     OR to_regclass('public.employees') IS NULL
     OR to_regclass('public.businesses') IS NULL THEN
    RAISE EXCEPTION 'purchase orders require products, suppliers, employees, and businesses';
  END IF;
END;
$pre$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  ordering_employee_id uuid REFERENCES public.employees(id),
  supplier_reference text,
  order_number text,
  ordered_on date NOT NULL DEFAULT CURRENT_DATE,
  expected_on date,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'awaiting_receipt', 'partially_received', 'completed', 'cancelled'
  )),
  completion text CHECK (completion IN ('fully_received', 'closed_unfulfilled')),
  close_reason text,
  idempotency_key uuid NOT NULL,
  last_request_key uuid,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, order_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  product_id uuid REFERENCES public.products(id),
  brand text,
  model text,
  size_label text,
  load_index text,
  speed_rating text,
  supplier_sku text,
  barcode text,
  description text,
  ordered_qty integer NOT NULL CHECK (ordered_qty > 0),
  received_qty integer NOT NULL DEFAULT 0 CHECK (received_qty >= 0 AND received_qty <= ordered_qty),
  agreed_unit_cost numeric CHECK (agreed_unit_cost IS NULL OR agreed_unit_cost >= 0)
);

-- A supplier SKU may repeat for the same product. The receipt function rejects
-- the same SKU on a different product. A unique index would also block a
-- second order for the same product.

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  receiving_employee_id uuid NOT NULL REFERENCES public.employees(id),
  idempotency_key uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.purchase_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  receipt_id uuid NOT NULL REFERENCES public.purchase_receipts(id),
  purchase_order_line_id uuid NOT NULL REFERENCES public.purchase_order_lines(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  agreed_unit_cost numeric,
  actual_unit_cost numeric CHECK (actual_unit_cost IS NULL OR actual_unit_cost >= 0),
  cost_ack_employee_id uuid,
  cost_ack_at timestamptz,
  cost_reason text
);

CREATE TABLE IF NOT EXISTS public.purchase_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  employee_id uuid,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_orders_read ON public.purchase_orders;
CREATE POLICY purchase_orders_read ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
DROP POLICY IF EXISTS purchase_order_lines_read ON public.purchase_order_lines;
CREATE POLICY purchase_order_lines_read ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
DROP POLICY IF EXISTS purchase_receipts_read ON public.purchase_receipts;
CREATE POLICY purchase_receipts_read ON public.purchase_receipts FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
DROP POLICY IF EXISTS purchase_receipt_lines_read ON public.purchase_receipt_lines;
CREATE POLICY purchase_receipt_lines_read ON public.purchase_receipt_lines FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
DROP POLICY IF EXISTS purchase_order_events_read ON public.purchase_order_events;
CREATE POLICY purchase_order_events_read ON public.purchase_order_events FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

REVOKE ALL ON TABLE
  public.purchase_orders, public.purchase_order_lines, public.purchase_receipts,
  public.purchase_receipt_lines, public.purchase_order_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.purchase_orders, public.purchase_order_lines, public.purchase_receipts,
  public.purchase_receipt_lines, public.purchase_order_events
TO authenticated;

DROP FUNCTION IF EXISTS public.save_purchase_order(uuid, uuid, boolean, uuid, uuid, date, jsonb);

CREATE OR REPLACE FUNCTION public.save_purchase_order(
  p_business_id uuid,
  p_idempotency_key uuid,
  p_confirm boolean,
  p_supplier_id uuid,
  p_employee_id uuid,
  p_ordered_on date,
  p_lines jsonb,
  p_order_id uuid DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,
  p_expected_on date DEFAULT NULL,
  p_supplier_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $save$
DECLARE
  v_existing uuid;
  v_id uuid;
  v_status text;
  v_version integer;
  v_number text;
  v_creation uuid;
  v_last uuid;
  v_line jsonb;
  v_cost numeric;
  v_product uuid;
BEGIN
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':po:' || coalesce(p_order_id::text, p_idempotency_key::text), 0));

  IF p_order_id IS NULL THEN
    SELECT id INTO v_existing FROM public.purchase_orders
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_existing, 'replayed', true);
    END IF;
  ELSE
    SELECT id, status, version, order_number, idempotency_key, last_request_key
      INTO v_id, v_status, v_version, v_number, v_creation, v_last
    FROM public.purchase_orders
    WHERE id = p_order_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
    IF v_last = p_idempotency_key OR v_creation = p_idempotency_key THEN
      RETURN jsonb_build_object('id', v_id, 'order_number', v_number, 'replayed', true);
    END IF;
    IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'order is not a draft'; END IF;
    IF v_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'version conflict'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.purchase_order_lines
      WHERE purchase_order_id = v_id AND received_qty > 0
    ) THEN RAISE EXCEPTION 'order is not a draft'; END IF;
  END IF;

  IF p_supplier_id IS NULL OR p_employee_id IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'order is incomplete';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND business_id = p_business_id) THEN
    RAISE EXCEPTION 'supplier not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND business_id = p_business_id AND is_active) THEN
    RAISE EXCEPTION 'employee not found';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF coalesce((v_line->>'quantity')::int, 0) <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    v_cost := NULLIF(v_line->>'agreed_unit_cost', '')::numeric;
    IF v_cost IS NOT NULL AND v_cost < 0 THEN RAISE EXCEPTION 'invalid cost'; END IF;
    IF p_confirm AND v_cost IS NULL THEN RAISE EXCEPTION 'unknown cost is not zero'; END IF;
    v_product := NULLIF(v_line->>'product_id', '')::uuid;
    IF v_product IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product AND business_id = p_business_id) THEN
        RAISE EXCEPTION 'product not found';
      END IF;
    ELSIF coalesce(btrim(v_line->>'brand'), '') = ''
       OR coalesce(btrim(v_line->>'model'), '') = ''
       OR coalesce(btrim(v_line->>'size_label'), '') = ''
       OR coalesce(btrim(v_line->>'load_index'), '') = ''
       OR coalesce(btrim(v_line->>'speed_rating'), '') = '' THEN
      RAISE EXCEPTION 'new specification is incomplete';
    END IF;
  END LOOP;

  IF p_order_id IS NULL THEN
    IF p_confirm THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':po-number', 0));
      SELECT 'PO-' || (coalesce(max(substring(order_number from '^PO-([0-9]+)$')::int), 0) + 1)
        INTO v_number FROM public.purchase_orders WHERE business_id = p_business_id;
    END IF;
    INSERT INTO public.purchase_orders (
      business_id, supplier_id, ordering_employee_id, ordered_on, expected_on, supplier_reference, notes,
      status, idempotency_key, last_request_key, version, confirmed_by, confirmed_at, order_number
    ) VALUES (
      p_business_id, p_supplier_id, p_employee_id, coalesce(p_ordered_on, CURRENT_DATE), p_expected_on,
      NULLIF(p_supplier_reference, ''), NULLIF(p_notes, ''),
      CASE WHEN p_confirm THEN 'awaiting_receipt' ELSE 'draft' END,
      p_idempotency_key, p_idempotency_key, 1,
      CASE WHEN p_confirm THEN auth.uid() ELSE NULL END,
      CASE WHEN p_confirm THEN now() ELSE NULL END, v_number
    ) RETURNING id INTO v_id;
  ELSE
    IF p_confirm AND v_number IS NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':po-number', 0));
      SELECT 'PO-' || (coalesce(max(substring(order_number from '^PO-([0-9]+)$')::int), 0) + 1)
        INTO v_number FROM public.purchase_orders WHERE business_id = p_business_id;
    END IF;
    UPDATE public.purchase_orders SET
      supplier_id = p_supplier_id,
      ordering_employee_id = p_employee_id,
      ordered_on = coalesce(p_ordered_on, ordered_on),
      expected_on = p_expected_on,
      supplier_reference = NULLIF(p_supplier_reference, ''),
      notes = NULLIF(p_notes, ''),
      status = CASE WHEN p_confirm THEN 'awaiting_receipt' ELSE 'draft' END,
      order_number = v_number,
      version = version + 1,
      last_request_key = p_idempotency_key,
      updated_at = now(),
      confirmed_by = CASE WHEN p_confirm THEN auth.uid() ELSE confirmed_by END,
      confirmed_at = CASE WHEN p_confirm THEN now() ELSE confirmed_at END
    WHERE id = v_id;
    DELETE FROM public.purchase_order_lines WHERE purchase_order_id = v_id AND business_id = p_business_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.purchase_order_lines (
      business_id, purchase_order_id, product_id, brand, model, size_label, load_index, speed_rating,
      supplier_sku, barcode, description, ordered_qty, agreed_unit_cost
    ) VALUES (
      p_business_id, v_id, NULLIF(v_line->>'product_id', '')::uuid, v_line->>'brand', v_line->>'model',
      v_line->>'size_label', v_line->>'load_index', v_line->>'speed_rating', NULLIF(v_line->>'supplier_sku', ''),
      NULLIF(v_line->>'barcode', ''), NULLIF(v_line->>'description', ''),
      (v_line->>'quantity')::int, NULLIF(v_line->>'agreed_unit_cost', '')::numeric
    );
  END LOOP;
  INSERT INTO public.purchase_order_events (business_id, purchase_order_id, employee_id, event_type)
  VALUES (
    p_business_id, v_id, p_employee_id,
    CASE
      WHEN p_order_id IS NOT NULL AND p_confirm THEN 'draft_confirmed'
      WHEN p_order_id IS NOT NULL THEN 'draft_updated'
      WHEN p_confirm THEN 'confirmed'
      ELSE 'draft'
    END
  );
  RETURN jsonb_build_object('id', v_id, 'order_number', v_number, 'replayed', false);
END;
$save$;

CREATE OR REPLACE FUNCTION public.post_purchase_receipt(
  p_business_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_receiving_employee_id uuid,
  p_lines jsonb,
  p_update_current_cost boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $post$
DECLARE
  v_existing uuid;
  v_status text;
  v_supplier uuid;
  v_receipt uuid;
  v_line jsonb;
  v_order_line record;
  v_qty integer;
  v_product uuid;
  v_receipt_line uuid;
  v_actual numeric;
  v_before integer;
  v_cost numeric;
  v_new_cost numeric;
BEGIN
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_receiving_employee_id AND business_id = p_business_id AND is_active
  ) THEN RAISE EXCEPTION 'receiving employee not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':receipt:' || p_idempotency_key::text, 0));
  SELECT id INTO v_existing FROM public.purchase_receipts
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'replayed', true);
  END IF;
  SELECT status, supplier_id INTO v_status, v_supplier
  FROM public.purchase_orders WHERE id = p_order_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_status NOT IN ('awaiting_receipt', 'partially_received') THEN
    RAISE EXCEPTION 'order cannot be received';
  END IF;
  INSERT INTO public.purchase_receipts (business_id, purchase_order_id, receiving_employee_id, idempotency_key)
  VALUES (p_business_id, p_order_id, p_receiving_employee_id, p_idempotency_key)
  RETURNING id INTO v_receipt;
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    SELECT * INTO v_order_line FROM public.purchase_order_lines
    WHERE id = (v_line->>'line_id')::uuid AND purchase_order_id = p_order_id FOR UPDATE;
    IF NOT FOUND OR v_order_line.received_qty + v_qty > v_order_line.ordered_qty THEN
      RAISE EXCEPTION 'quantity exceeds the open balance';
    END IF;
    v_actual := NULLIF(v_line->>'actual_unit_cost', '')::numeric;
    IF v_actual IS DISTINCT FROM v_order_line.agreed_unit_cost AND (v_line->>'cost_ack')::boolean IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'a cost difference requires acknowledgment';
    END IF;
    v_product := coalesce(v_order_line.product_id, NULLIF(v_line->>'product_id', '')::uuid);
    IF v_product IS NULL AND (v_line->>'create_product')::boolean IS TRUE THEN
      INSERT INTO public.products (business_id, name, created_by, quantity)
      VALUES (
        p_business_id,
        concat_ws(' ', v_order_line.brand, v_order_line.model, v_order_line.size_label, v_order_line.load_index, v_order_line.speed_rating),
        auth.uid(), 0
      ) RETURNING id INTO v_product;
      UPDATE public.purchase_order_lines SET product_id = v_product WHERE id = v_order_line.id;
    END IF;
    IF v_product IS NULL THEN RAISE EXCEPTION 'the line is not one catalog product'; END IF;
    IF v_order_line.supplier_sku IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.purchase_order_lines other
      WHERE other.business_id = p_business_id AND other.supplier_sku = v_order_line.supplier_sku
        AND other.product_id IS NOT NULL AND other.product_id <> v_product
    ) THEN RAISE EXCEPTION 'supplier sku belongs to another product'; END IF;
    SELECT quantity, cost INTO v_before, v_cost FROM public.products
    WHERE id = v_product AND business_id = p_business_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
    INSERT INTO public.purchase_receipt_lines (
      business_id, receipt_id, purchase_order_line_id, product_id, quantity, agreed_unit_cost, actual_unit_cost,
      cost_ack_employee_id, cost_ack_at, cost_reason
    ) VALUES (
      p_business_id, v_receipt, v_order_line.id, v_product, v_qty, v_order_line.agreed_unit_cost, v_actual,
      CASE WHEN v_actual IS DISTINCT FROM v_order_line.agreed_unit_cost THEN p_receiving_employee_id ELSE NULL END,
      CASE WHEN v_actual IS DISTINCT FROM v_order_line.agreed_unit_cost THEN now() ELSE NULL END,
      NULLIF(v_line->>'cost_reason', '')
    ) RETURNING id INTO v_receipt_line;
    UPDATE public.purchase_order_lines SET received_qty = received_qty + v_qty, product_id = v_product WHERE id = v_order_line.id;
    v_new_cost := v_cost;
    IF p_update_current_cost AND v_actual IS NOT NULL THEN
      IF v_cost IS NULL AND coalesce(v_before, 0) > 0 THEN v_new_cost := NULL;
      ELSE v_new_cost := ((coalesce(v_before, 0) * coalesce(v_cost, 0)) + (v_qty * v_actual)) / (coalesce(v_before, 0) + v_qty);
      END IF;
    END IF;
    UPDATE public.products
    SET quantity = coalesce(quantity, 0) + v_qty, cost = v_new_cost, updated_at = now()
    WHERE id = v_product AND business_id = p_business_id;
    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency, purchase_unit_ils, purchase_total_ils,
      supplier_id, notes, timestamp, source, reference_type, reference_id, is_reversal, reference_meta
    ) VALUES (
      p_business_id, auth.uid(), v_product, 'purchase', v_qty, 'ILS', v_actual,
      CASE WHEN v_actual IS NULL THEN NULL ELSE v_actual * v_qty END, v_supplier, 'קליטת הזמנת רכש', now(),
      'purchase_receipt', 'purchase_receipt', v_receipt_line, false,
      jsonb_build_object('stock_before', coalesce(v_before, 0), 'stock_after', coalesce(v_before, 0) + v_qty, 'order_id', p_order_id, 'receiving_employee_id', p_receiving_employee_id)
    );
    INSERT INTO public.inventory_lots (
      business_id, product_id, received_at, original_quantity, remaining_quantity, unit_cost_ils, supplier_id,
      source_type, receipt_reference_type, receipt_reference_id
    ) VALUES (
      p_business_id, v_product, now(), v_qty, v_qty, v_actual, v_supplier,
      'purchase_receipt', 'purchase_receipt', v_receipt
    );
  END LOOP;
  UPDATE public.purchase_orders o SET
    status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.purchase_order_lines l WHERE l.purchase_order_id = o.id AND l.received_qty < l.ordered_qty) THEN 'completed'
      ELSE 'partially_received' END,
    completion = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.purchase_order_lines l WHERE l.purchase_order_id = o.id AND l.received_qty < l.ordered_qty) THEN 'fully_received'
      ELSE NULL END
  WHERE o.id = p_order_id;
  INSERT INTO public.purchase_order_events (business_id, purchase_order_id, employee_id, event_type, detail)
  VALUES (p_business_id, p_order_id, p_receiving_employee_id, 'received', jsonb_build_object('receipt_id', v_receipt));
  RETURN jsonb_build_object('id', v_receipt, 'replayed', false);
END;
$post$;

REVOKE ALL ON FUNCTION public.save_purchase_order(uuid, uuid, boolean, uuid, uuid, date, jsonb, uuid, integer, date, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_purchase_order(uuid, uuid, boolean, uuid, uuid, date, jsonb, uuid, integer, date, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.post_purchase_receipt(uuid, uuid, uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated, service_role;
-- post_purchase_receipt has no execute grant. Physical receiving stays inactive.

COMMENT ON TABLE public.purchase_orders IS
  'UNAPPLIED. A draft is not an order. Confirmation does not change stock. Receipt, stock, movement and FIFO lot commit together or not at all.';

COMMIT;
