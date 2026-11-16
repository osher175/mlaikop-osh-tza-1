-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Apply only after docs/v2/salesperson-required-b.enforcement.sql.
-- Migration B replaces complete_quick_sale. This file replaces it again.
-- Applying this file first and then B removes the list-price behavior.
-- The signature stays complete_quick_sale(uuid, uuid, uuid, text, jsonb).
-- The current client already sends unit_price_gross and list_unit_gross.
--
-- The locked products.price is the catalog snapshot. A client list price that
-- does not match it is rejected, so a browser cannot raise the list price to
-- invent a discount. A missing catalog price stays NULL and creates no discount.
-- The charged unit price stays unit_price_gross. Existing rows are not updated.
-- The stock movement still has no sale_total_ils, so revenue stays on sale_lines.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.sale_lines
  ADD COLUMN IF NOT EXISTS list_unit_gross_ils numeric(14, 2),
  ADD COLUMN IF NOT EXISTS discount_ils numeric(14, 2),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(8, 4);

ALTER TABLE public.sale_lines
  DROP CONSTRAINT IF EXISTS sale_lines_discount_matches_list;
ALTER TABLE public.sale_lines
  ADD CONSTRAINT sale_lines_discount_matches_list
  CHECK (
    (list_unit_gross_ils IS NULL AND discount_ils IS NULL AND discount_percent IS NULL)
    OR (list_unit_gross_ils IS NOT NULL AND discount_ils IS NOT NULL AND discount_ils >= 0)
  ) NOT VALID;

COMMENT ON COLUMN public.sale_lines.list_unit_gross_ils IS
  'Catalog unit price locked at confirmation, VAT inclusive. Null means the catalog price was unknown. Not a client-supplied number and not filled from a later product price.';

CREATE OR REPLACE FUNCTION public.complete_quick_sale(
  p_business_id uuid,
  p_idempotency_key uuid,
  p_salesperson_employee_id uuid,
  p_notes text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $complete$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_txn uuid;
  v_active boolean;
  v_rec record;
  v_item jsonb;
  v_index integer := 0;
  v_product uuid;
  v_qty integer;
  v_price numeric;
  v_list numeric;
  v_client_list jsonb;
  v_discount numeric;
  v_discount_percent numeric;
  v_axle text;
  v_stock integer;
  v_cost numeric;
  v_action uuid;
  v_needed integer;
  v_line_gross numeric(16, 2);
  v_line_net numeric(16, 2);
  v_line_vat numeric(16, 2);
  v_line_cost numeric(16, 2);
  v_units integer := 0;
  v_gross numeric(16, 2) := 0;
  v_known_cost numeric(16, 2) := 0;
  v_known_lines integer := 0;
  v_net numeric(16, 2);
  v_vat_amount numeric(16, 2);
  v_prepared jsonb := '[]'::jsonb;
  v_vat numeric(6, 4) := 0.1800;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_idempotency_key IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid quick sale';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 50 THEN
    RAISE EXCEPTION 'a sale needs between 1 and 50 lines';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
    RAISE EXCEPTION 'notes are too long';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_idempotency_key::text, 0));

  SELECT id INTO v_existing
  FROM public.sale_transactions
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
  END IF;

  IF p_salesperson_employee_id IS NULL THEN
    RAISE EXCEPTION 'salesperson is required' USING ERRCODE = '23502';
  END IF;
  SELECT e.is_active INTO v_active
  FROM public.employees e
  WHERE e.id = p_salesperson_employee_id AND e.business_id = p_business_id;
  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'salesperson must be an active employee of this business' USING ERRCODE = '42501';
  END IF;

  PERFORM p.id
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.id IN (SELECT DISTINCT (line->>'product_id')::uuid FROM jsonb_array_elements(p_lines) line)
  ORDER BY p.id
  FOR UPDATE;

  FOR v_product, v_needed IN
    SELECT (line->>'product_id')::uuid, SUM((line->>'quantity')::integer)::integer
    FROM jsonb_array_elements(p_lines) line
    GROUP BY 1
  LOOP
    IF v_product IS NULL OR v_needed IS NULL OR v_needed < 1 OR v_needed > 100000 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;
    SELECT quantity INTO v_stock
    FROM public.products
    WHERE id = v_product AND business_id = p_business_id;
    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'product is not in this business';
    END IF;
    IF v_stock < v_needed THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR v_rec IN
    SELECT line.value AS item, line.ordinality::integer AS line_position
    FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS line(value, ordinality)
  LOOP
    v_index := v_rec.line_position;
    v_item := v_rec.item;
    v_product := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unit_price_gross')::numeric;
    v_axle := COALESCE(v_item->>'axle', 'single');
    IF v_product IS NULL
       OR v_qty IS NULL OR v_qty < 1 OR v_qty > 10000
       OR v_price IS NULL OR v_price < 0 OR v_price > 9999999.99
       OR v_price <> round(v_price, 2)
       OR v_axle NOT IN ('single', 'front', 'rear') THEN
      RAISE EXCEPTION 'invalid sale line';
    END IF;

    SELECT cost, price INTO v_cost, v_list
    FROM public.products
    WHERE id = v_product AND business_id = p_business_id;
    IF v_cost IS NOT NULL AND v_cost < 0 THEN
      RAISE EXCEPTION 'product cost is invalid';
    END IF;

    v_client_list := v_item->'list_unit_gross';
    IF v_item ? 'list_unit_gross' THEN
      IF v_client_list = 'null'::jsonb THEN
        IF v_list IS NOT NULL THEN
          RAISE EXCEPTION 'list price does not match the catalog' USING ERRCODE = '23514';
        END IF;
      ELSIF v_list IS NULL OR (v_client_list #>> '{}')::numeric IS DISTINCT FROM v_list THEN
        RAISE EXCEPTION 'list price does not match the catalog' USING ERRCODE = '23514';
      END IF;
    END IF;

    v_line_gross := round(v_price * v_qty, 2);
    v_line_net := round(v_line_gross / (1 + v_vat), 2);
    v_line_vat := v_line_gross - v_line_net;
    v_line_cost := CASE WHEN v_cost IS NULL THEN NULL ELSE round(v_cost * v_qty, 2) END;
    IF v_list IS NULL THEN
      v_discount := NULL;
      v_discount_percent := NULL;
    ELSE
      v_discount := round(v_list * v_qty, 2) - v_line_gross;
      IF v_discount > 0 THEN
        v_discount_percent := round((v_discount / round(v_list * v_qty, 2)) * 100, 4);
      ELSE
        v_discount := 0;
        v_discount_percent := 0;
      END IF;
    END IF;
    v_units := v_units + v_qty;
    v_gross := v_gross + v_line_gross;
    IF v_cost IS NULL THEN
      NULL;
    ELSE
      v_known_lines := v_known_lines + 1;
      v_known_cost := v_known_cost + v_line_cost;
    END IF;

    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'position', v_index,
      'product_id', v_product,
      'quantity', v_qty,
      'unit_price_gross', v_price,
      'list_unit', v_list,
      'discount_ils', v_discount,
      'discount_percent', v_discount_percent,
      'axle', v_axle,
      'unit_cost', v_cost,
      'line_gross', v_line_gross,
      'line_net', v_line_net,
      'line_vat', v_line_vat,
      'line_cost', v_line_cost
    ));
  END LOOP;

  IF v_index <> jsonb_array_length(p_lines) THEN
    RAISE EXCEPTION 'invalid quick sale';
  END IF;

  v_net := round(v_gross / (1 + v_vat), 2);
  v_vat_amount := v_gross - v_net;

  INSERT INTO public.sale_transactions (
    business_id, idempotency_key, salesperson_employee_id, notes, vat_rate, created_by,
    line_count, units_total, revenue_gross_ils, revenue_net_ils, vat_amount_ils,
    known_cost_ex_vat_ils, cost_known_lines
  ) VALUES (
    p_business_id, p_idempotency_key, p_salesperson_employee_id,
    NULLIF(btrim(p_notes), ''), v_vat, v_uid,
    v_index, v_units, v_gross, v_net, v_vat_amount,
    CASE WHEN v_known_lines = 0 THEN NULL ELSE v_known_cost END,
    v_known_lines
  )
  ON CONFLICT (business_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_txn;

  IF v_txn IS NULL THEN
    SELECT id INTO v_existing
    FROM public.sale_transactions
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
  END IF;

  FOR v_rec IN
    SELECT value AS item FROM jsonb_array_elements(v_prepared)
  LOOP
    v_item := v_rec.item;
    v_product := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unit_price_gross')::numeric;
    v_list := (v_item->>'list_unit')::numeric;
    v_discount := (v_item->>'discount_ils')::numeric;
    v_discount_percent := (v_item->>'discount_percent')::numeric;
    v_cost := (v_item->>'unit_cost')::numeric;
    v_index := (v_item->>'position')::integer;
    v_axle := v_item->>'axle';
    v_line_gross := (v_item->>'line_gross')::numeric;
    v_line_net := (v_item->>'line_net')::numeric;
    v_line_vat := (v_item->>'line_vat')::numeric;
    v_line_cost := (v_item->>'line_cost')::numeric;

    UPDATE public.products
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE id = v_product AND business_id = p_business_id AND quantity >= v_qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      cost_snapshot_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent,
      notes, timestamp, reference_type, reference_id, source, is_reversal
    ) VALUES (
      p_business_id, v_uid, v_product, 'sale', -v_qty, 'ILS',
      v_cost, v_price, v_list, v_discount, v_discount_percent,
      'quick sale', now(), 'sale_transaction', v_txn, 'sale_transaction', false
    )
    RETURNING id INTO v_action;

    INSERT INTO public.sale_lines (
      business_id, transaction_id, product_id, position, quantity,
      unit_price_gross_ils, list_unit_gross_ils, discount_ils, discount_percent,
      vat_rate, unit_cost_ils,
      line_revenue_gross_ils, line_revenue_net_ils, line_vat_ils, line_cost_ex_vat_ils,
      inventory_action_id, axle
    ) VALUES (
      p_business_id, v_txn, v_product, v_index, v_qty,
      v_price, v_list, v_discount, v_discount_percent,
      v_vat, v_cost,
      v_line_gross, v_line_net, v_line_vat, v_line_cost,
      v_action, v_axle
    );
  END LOOP;

  RETURN jsonb_build_object('transaction_id', v_txn, 'replayed', false);
END;
$complete$;

COMMENT ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) IS
  'Confirms one V2 sale for one active employee. List price is the locked catalog price. A client list price that differs is rejected. Null catalog price stores no discount. Charged price is separate. Same idempotency key does not deduct again. Stock rows keep sale_total_ils null. Does not update historical rows.';

GRANT EXECUTE ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;

COMMIT;
