-- =========================================================
-- Phase 3: Import closure & final landed-cost posting
-- =========================================================

CREATE TABLE IF NOT EXISTS public.import_cost_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  import_order_item_id uuid NOT NULL REFERENCES public.import_order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  received_quantity integer NOT NULL,
  provisional_unit_cost_ils numeric NOT NULL,
  final_unit_cost_ils numeric NOT NULL,
  unit_variance_ils numeric NOT NULL,
  total_variance_ils numeric NOT NULL,
  quantity_on_hand_at_close integer NOT NULL,
  quantity_applied integer NOT NULL,
  applied_amount_ils numeric NOT NULL,
  unabsorbed_amount_ils numeric NOT NULL,
  product_cost_before_ils numeric NOT NULL,
  product_cost_after_ils numeric NOT NULL,
  actor_user_id uuid,
  reason text NOT NULL DEFAULT 'import_closure_final_cost',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.import_cost_adjustments TO authenticated;
GRANT ALL ON public.import_cost_adjustments TO service_role;

ALTER TABLE public.import_cost_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import managers can view cost adjustments"
ON public.import_cost_adjustments FOR SELECT TO authenticated
USING (public.can_manage_business_imports(business_id, auth.uid()));

-- structural idempotency: one posting per import line, ever
CREATE UNIQUE INDEX IF NOT EXISTS import_cost_adjustments_unique_line
  ON public.import_cost_adjustments (import_order_id, import_order_item_id);

CREATE INDEX IF NOT EXISTS import_cost_adjustments_product_idx
  ON public.import_cost_adjustments (business_id, product_id, created_at DESC);

-- immutability
CREATE OR REPLACE FUNCTION public.import_cost_adjustments_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'רישומי התאמת עלות יבוא הם בלתי ניתנים לשינוי' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_import_cost_adjustments_immutable ON public.import_cost_adjustments;
CREATE TRIGGER trg_import_cost_adjustments_immutable
BEFORE UPDATE OR DELETE ON public.import_cost_adjustments
FOR EACH ROW EXECUTE FUNCTION public.import_cost_adjustments_immutable();

-- ---------------------------------------------------------
-- Readiness + preview
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_closure_readiness(p_import_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order public.import_orders;
  v_rate numeric;
  v_overhead numeric;
  v_units numeric;
  v_per_unit numeric;
  v_has_receipt boolean;
  v_open_qty integer;
  v_unlinked integer;
  v_open_costs integer;
  v_open_drafts integer;
  v_items jsonb;
  v_already boolean;
BEGIN
  SELECT * INTO v_order FROM public.import_orders WHERE id = p_import_order_id;
  IF v_order.id IS NULL OR NOT public.can_manage_business_imports(v_order.business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_rate := COALESCE(v_order.working_exchange_rate_to_ils, 1);

  SELECT COALESCE(sum(effective_amount_ils), 0) INTO v_overhead
  FROM public.import_costs WHERE import_order_id = p_import_order_id;

  SELECT COALESCE(sum(received_quantity), 0) INTO v_units
  FROM public.import_order_items
  WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled';

  v_per_unit := CASE WHEN v_units > 0 THEN round(v_overhead / v_units, 4) ELSE 0 END;

  SELECT EXISTS (SELECT 1 FROM public.import_receipts
                 WHERE import_order_id = p_import_order_id AND status = 'confirmed')
    INTO v_has_receipt;

  SELECT COALESCE(sum(GREATEST(ordered_quantity - received_quantity - not_arriving_quantity, 0)), 0)
    INTO v_open_qty
  FROM public.import_order_items
  WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled';

  SELECT count(*) INTO v_unlinked
  FROM public.import_order_items
  WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'
    AND received_quantity > 0 AND product_id IS NULL;

  SELECT count(*) INTO v_open_costs
  FROM public.import_costs
  WHERE import_order_id = p_import_order_id AND final_amount IS NULL;

  SELECT count(*) INTO v_open_drafts
  FROM public.import_receipts
  WHERE import_order_id = p_import_order_id AND status = 'draft';

  SELECT EXISTS (SELECT 1 FROM public.import_cost_adjustments
                 WHERE import_order_id = p_import_order_id) INTO v_already;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'description'), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'item_id', i.id,
      'product_id', i.product_id,
      'description', i.product_description,
      'received_quantity', i.received_quantity,
      'provisional_unit_cost_ils',
        round(COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate), 4),
      'overhead_per_unit_ils', v_per_unit,
      'final_unit_cost_ils',
        round(COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit, 4),
      'unit_variance_ils', v_per_unit,
      'total_variance_ils', round(v_per_unit * i.received_quantity, 2),
      'quantity_on_hand', COALESCE(p.quantity, 0),
      'current_product_cost_ils', COALESCE(p.cost, 0),
      'current_price_ils', p.price,
      'planned_sale_price_ils', i.planned_sale_price_ils,
      'gross_profit_per_unit_ils',
        CASE WHEN COALESCE(i.planned_sale_price_ils, p.price) IS NULL THEN NULL
             ELSE round(COALESCE(i.planned_sale_price_ils, p.price)
                  - (COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit), 2) END,
      'gross_margin_percent',
        CASE WHEN COALESCE(i.planned_sale_price_ils, p.price) IS NULL
                  OR COALESCE(i.planned_sale_price_ils, p.price) = 0 THEN NULL
             ELSE round(((COALESCE(i.planned_sale_price_ils, p.price)
                  - (COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit))
                  / COALESCE(i.planned_sale_price_ils, p.price)) * 100, 2) END
    ) AS x
    FROM public.import_order_items i
    LEFT JOIN public.products p ON p.id = i.product_id
    WHERE i.import_order_id = p_import_order_id
      AND i.item_status <> 'cancelled'
      AND i.received_quantity > 0
  ) s;

  RETURN jsonb_build_object(
    'order_status', v_order.status,
    'already_closed', v_order.status IN ('completed', 'cancelled'),
    'already_posted', v_already,
    'has_confirmed_receipt', v_has_receipt,
    'open_quantity', v_open_qty,
    'unlinked_received_items', v_unlinked,
    'unfinalized_cost_lines', v_open_costs,
    'open_draft_receipts', v_open_drafts,
    'total_overhead_ils', round(v_overhead, 2),
    'applicable_received_units', v_units,
    'overhead_per_unit_ils', v_per_unit,
    'can_close',
      (v_order.status NOT IN ('completed', 'cancelled'))
      AND v_has_receipt
      AND v_open_qty = 0
      AND v_unlinked = 0
      AND v_open_drafts = 0
      AND NOT v_already,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_closure_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_closure_readiness(uuid) TO authenticated;

-- ---------------------------------------------------------
-- Closure: final landed cost posting (cost-only, idempotent)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_order_close(
  p_import_order_id uuid,
  p_pin_token uuid DEFAULT NULL,
  p_price_updates jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_order public.import_orders;
  v_rate numeric;
  v_overhead numeric;
  v_units numeric;
  v_per_unit numeric;
  v_line record;
  v_prov numeric;
  v_final numeric;
  v_onhand integer;
  v_cost_before numeric;
  v_cost_after numeric;
  v_applied integer;
  v_applied_amt numeric;
  v_unabsorbed numeric;
  v_pin_ok boolean;
  v_pin_configured boolean;
  v_lines integer := 0;
  v_total_variance numeric := 0;
  v_total_applied numeric := 0;
  v_total_unabsorbed numeric := 0;
  v_price jsonb;
  v_price_updates integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.import_orders WHERE id = p_import_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import order not found';
  END IF;
  IF NOT public.can_manage_business_imports(v_order.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- step-up PIN, when the business configured one
  SELECT is_configured INTO v_pin_configured FROM public.import_pin_status(v_order.business_id);
  IF COALESCE(v_pin_configured, false) THEN
    IF p_pin_token IS NULL THEN
      RAISE EXCEPTION 'נדרש שחרור קוד יבוא לפני סגירת ההזמנה' USING ERRCODE = '42501';
    END IF;
    SELECT valid INTO v_pin_ok
    FROM public.import_pin_session_touch(v_order.business_id, p_pin_token);
    IF NOT COALESCE(v_pin_ok, false) THEN
      RAISE EXCEPTION 'נדרש שחרור קוד יבוא לפני סגירת ההזמנה' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'ההזמנה כבר נסגרה (%) — לא ניתן לסגור פעמיים', v_order.status
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.import_cost_adjustments WHERE import_order_id = p_import_order_id) THEN
    RAISE EXCEPTION 'עלות סופית כבר נרשמה עבור הזמנה זו' USING ERRCODE = '55000';
  END IF;

  -- readiness preconditions (server side, not only UI)
  IF NOT EXISTS (SELECT 1 FROM public.import_receipts
                 WHERE import_order_id = p_import_order_id AND status = 'confirmed') THEN
    RAISE EXCEPTION 'לא ניתן לסגור הזמנה ללא קליטה מאושרת אחת לפחות';
  END IF;
  IF EXISTS (SELECT 1 FROM public.import_receipts
             WHERE import_order_id = p_import_order_id AND status = 'draft') THEN
    RAISE EXCEPTION 'קיימת טיוטת קליטה פתוחה — יש לאשר או לבטל אותה';
  END IF;
  IF EXISTS (SELECT 1 FROM public.import_order_items
             WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'
               AND GREATEST(ordered_quantity - received_quantity - not_arriving_quantity, 0) > 0) THEN
    RAISE EXCEPTION 'קיימות כמויות פתוחות שלא נקלטו ולא נסגרו כחוסר';
  END IF;
  IF EXISTS (SELECT 1 FROM public.import_order_items
             WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'
               AND received_quantity > 0 AND product_id IS NULL) THEN
    RAISE EXCEPTION 'קיימים פריטים שנקלטו ואינם מקושרים למוצר';
  END IF;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (p_import_order_id, v_order.business_id, 'closure_started', v_caller, '{}'::jsonb);

  v_rate := COALESCE(v_order.working_exchange_rate_to_ils, 1);

  SELECT COALESCE(sum(effective_amount_ils), 0) INTO v_overhead
  FROM public.import_costs WHERE import_order_id = p_import_order_id;

  SELECT COALESCE(sum(received_quantity), 0) INTO v_units
  FROM public.import_order_items
  WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled';

  v_per_unit := CASE WHEN v_units > 0 THEN round(v_overhead / v_units, 4) ELSE 0 END;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (p_import_order_id, v_order.business_id, 'final_cost_calculated', v_caller,
          jsonb_build_object('overhead_total_ils', round(v_overhead, 2),
                             'received_units', v_units,
                             'overhead_per_unit_ils', v_per_unit));

  FOR v_line IN
    SELECT i.id, i.product_id, i.received_quantity, i.expected_unit_cost_ils,
           i.supplier_unit_cost, i.product_description
    FROM public.import_order_items i
    WHERE i.import_order_id = p_import_order_id
      AND i.item_status <> 'cancelled'
      AND i.received_quantity > 0
    ORDER BY i.id
    FOR UPDATE OF i
  LOOP
    v_prov := round(COALESCE(v_line.expected_unit_cost_ils, v_line.supplier_unit_cost * v_rate), 4);
    v_final := round(v_prov + v_per_unit, 4);

    SELECT quantity, COALESCE(cost, 0) INTO v_onhand, v_cost_before
    FROM public.products
    WHERE id = v_line.product_id AND business_id = v_order.business_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'המוצר המקושר לפריט "%" אינו שייך לעסק', v_line.product_description;
    END IF;

    -- Weighted-average revaluation: the variance can only be capitalised into
    -- units still on hand. Variance on units already sold stays unabsorbed and
    -- is recorded in the ledger — historical COGS snapshots are never rewritten.
    v_applied := LEAST(v_line.received_quantity, GREATEST(v_onhand, 0));
    v_applied_amt := round(v_per_unit * v_applied, 4);
    v_unabsorbed := round(v_per_unit * (v_line.received_quantity - v_applied), 4);

    IF v_onhand > 0 AND v_applied_amt <> 0 THEN
      v_cost_after := GREATEST(round(v_cost_before + (v_applied_amt / v_onhand), 4), 0);
      UPDATE public.products
      SET cost = v_cost_after, updated_at = now()
      WHERE id = v_line.product_id AND business_id = v_order.business_id;
    ELSE
      v_cost_after := v_cost_before;
    END IF;

    INSERT INTO public.import_cost_adjustments (
      business_id, import_order_id, import_order_item_id, product_id,
      received_quantity, provisional_unit_cost_ils, final_unit_cost_ils,
      unit_variance_ils, total_variance_ils, quantity_on_hand_at_close,
      quantity_applied, applied_amount_ils, unabsorbed_amount_ils,
      product_cost_before_ils, product_cost_after_ils, actor_user_id
    ) VALUES (
      v_order.business_id, p_import_order_id, v_line.id, v_line.product_id,
      v_line.received_quantity, v_prov, v_final,
      v_per_unit, round(v_per_unit * v_line.received_quantity, 4), v_onhand,
      v_applied, v_applied_amt, v_unabsorbed,
      v_cost_before, v_cost_after, v_caller
    );

    v_lines := v_lines + 1;
    v_total_variance := v_total_variance + round(v_per_unit * v_line.received_quantity, 4);
    v_total_applied := v_total_applied + v_applied_amt;
    v_total_unabsorbed := v_total_unabsorbed + v_unabsorbed;
  END LOOP;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (p_import_order_id, v_order.business_id, 'cost_adjustment_posted', v_caller,
          jsonb_build_object('lines', v_lines,
                             'total_variance_ils', round(v_total_variance, 2),
                             'applied_to_inventory_ils', round(v_total_applied, 2),
                             'unabsorbed_sold_units_ils', round(v_total_unabsorbed, 2)));

  -- explicit, opt-in sale price updates
  FOR v_price IN SELECT * FROM jsonb_array_elements(COALESCE(p_price_updates, '[]'::jsonb))
  LOOP
    UPDATE public.products p
    SET price = (v_price->>'price')::numeric, updated_at = now()
    FROM public.import_order_items i
    WHERE i.id = (v_price->>'item_id')::uuid
      AND i.import_order_id = p_import_order_id
      AND p.id = i.product_id
      AND p.business_id = v_order.business_id;
    IF FOUND THEN
      v_price_updates := v_price_updates + 1;
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (p_import_order_id, v_order.business_id, 'sale_price_updated', v_caller,
              jsonb_build_object('import_order_item_id', (v_price->>'item_id')::uuid,
                                 'price', (v_price->>'price')::numeric));
    END IF;
  END LOOP;

  UPDATE public.import_orders
  SET status = 'completed', closed_at = now(), updated_at = now()
  WHERE id = p_import_order_id;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (p_import_order_id, v_order.business_id, 'import_closed', v_caller,
          jsonb_build_object('lines', v_lines, 'price_updates', v_price_updates));

  RETURN jsonb_build_object(
    'success', true,
    'lines', v_lines,
    'overhead_per_unit_ils', v_per_unit,
    'total_variance_ils', round(v_total_variance, 2),
    'applied_to_inventory_ils', round(v_total_applied, 2),
    'unabsorbed_sold_units_ils', round(v_total_unabsorbed, 2),
    'price_updates', v_price_updates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_order_close(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_order_close(uuid, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------
-- Closed-import summary (read model for the summary tab)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_order_summary(p_import_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order public.import_orders;
  v_rate numeric;
  v_res jsonb;
BEGIN
  SELECT * INTO v_order FROM public.import_orders WHERE id = p_import_order_id;
  IF v_order.id IS NULL OR NOT public.can_manage_business_imports(v_order.business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_rate := COALESCE(v_order.working_exchange_rate_to_ils, 1);

  SELECT jsonb_build_object(
    'import_number', v_order.import_number,
    'supplier_name', (SELECT name FROM public.suppliers WHERE id = v_order.supplier_id),
    'purchase_type', v_order.purchase_type,
    'status', v_order.status,
    'order_date', v_order.order_date,
    'closed_at', v_order.closed_at,
    'brands', (SELECT COALESCE(jsonb_agg(DISTINCT b.name), '[]'::jsonb)
               FROM public.import_order_items i
               JOIN public.brands b ON b.id = i.brand_id
               WHERE i.import_order_id = p_import_order_id),
    'ordered_units', (SELECT COALESCE(sum(ordered_quantity), 0) FROM public.import_order_items
                      WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'),
    'received_units', (SELECT COALESCE(sum(received_quantity), 0) FROM public.import_order_items
                       WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'),
    'not_arriving_units', (SELECT COALESCE(sum(not_arriving_quantity), 0) FROM public.import_order_items
                           WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'),
    'goods_cost_ils', (SELECT COALESCE(sum(COALESCE(expected_unit_cost_ils, supplier_unit_cost * v_rate)
                                           * received_quantity), 0)
                       FROM public.import_order_items
                       WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'),
    'additional_costs_ils', (SELECT COALESCE(sum(effective_amount_ils), 0) FROM public.import_costs
                             WHERE import_order_id = p_import_order_id),
    'overhead_per_unit_ils', (SELECT CASE WHEN COALESCE(sum(i.received_quantity), 0) > 0
        THEN round((SELECT COALESCE(sum(effective_amount_ils), 0) FROM public.import_costs
                    WHERE import_order_id = p_import_order_id) / sum(i.received_quantity), 4)
        ELSE 0 END
      FROM public.import_order_items i
      WHERE i.import_order_id = p_import_order_id AND i.item_status <> 'cancelled'),
    'planned_sales_value_ils', (SELECT COALESCE(sum(COALESCE(planned_sale_price_ils, 0) * received_quantity), 0)
                                FROM public.import_order_items
                                WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled'),
    'payments_paid_ils', (SELECT COALESCE(sum(amount_ils), 0) FROM public.import_payments
                          WHERE import_order_id = p_import_order_id AND payment_status = 'paid'),
    'payments_outstanding_ils', (SELECT COALESCE(sum(amount_ils), 0) FROM public.import_payments
                                 WHERE import_order_id = p_import_order_id AND payment_status <> 'paid'),
    'adjustment_total_ils', (SELECT COALESCE(sum(total_variance_ils), 0) FROM public.import_cost_adjustments
                             WHERE import_order_id = p_import_order_id),
    'adjustment_applied_ils', (SELECT COALESCE(sum(applied_amount_ils), 0) FROM public.import_cost_adjustments
                               WHERE import_order_id = p_import_order_id),
    'adjustment_unabsorbed_ils', (SELECT COALESCE(sum(unabsorbed_amount_ils), 0) FROM public.import_cost_adjustments
                                  WHERE import_order_id = p_import_order_id)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.import_order_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_order_summary(uuid) TO authenticated;