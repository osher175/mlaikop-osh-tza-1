-- =====================================================================
-- Import Module — Phase 2: Receiving & Inventory Integration
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Provenance columns on the canonical inventory ledger
-- ---------------------------------------------------------------------
ALTER TABLE public.inventory_actions
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS reference_meta jsonb;

CREATE INDEX IF NOT EXISTS idx_inventory_actions_reference
  ON public.inventory_actions (business_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Canonical inventory mutation path — minimal backwards-compatible
--    extension: optional provenance params + neutral 'adjust' action.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.execute_inventory_transaction(
  uuid, uuid, uuid, text, integer, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, uuid, text);

CREATE OR REPLACE FUNCTION public.execute_inventory_transaction(
  p_business_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_action_type text,
  p_quantity_changed integer,
  p_sale_total_ils numeric DEFAULT NULL,
  p_sale_unit_ils numeric DEFAULT NULL,
  p_list_unit_ils numeric DEFAULT NULL,
  p_discount_ils numeric DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_cost_snapshot_ils numeric DEFAULT NULL,
  p_purchase_unit_ils numeric DEFAULT NULL,
  p_purchase_total_ils numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_meta jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
  v_actor UUID;
  v_current_quantity INTEGER;
  v_current_cost NUMERIC;
  v_new_quantity INTEGER;
  v_new_cost NUMERIC;
  v_action_id UUID;
  v_result JSONB;
BEGIN
  -- ---- SECURITY: fail-closed tenant authorization -------------------
  IF v_caller IS NULL THEN
    IF current_setting('role', true) = 'service_role'
       OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
      v_actor := p_user_id;
    ELSE
      RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_actor := v_caller;
  END IF;

  IF v_actor IS NULL OR p_business_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL
     AND NOT public.is_active_business_actor(p_business_id, v_caller) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;
  -- -------------------------------------------------------------------

  -- 'adjust' = financially neutral quantity correction (no sale semantics,
  -- rolling average left untouched). 'add' / 'remove' behave exactly as before.
  IF p_action_type NOT IN ('add', 'remove', 'adjust') THEN
    RAISE EXCEPTION 'Invalid action_type: %. Must be "add", "remove" or "adjust"', p_action_type;
  END IF;

  IF p_action_type = 'remove' THEN
    IF p_sale_total_ils IS NULL OR p_cost_snapshot_ils IS NULL THEN
      RAISE EXCEPTION 'Sale (remove) requires sale_total_ils and cost_snapshot_ils';
    END IF;
  ELSIF p_action_type = 'add' THEN
    IF p_purchase_unit_ils IS NULL THEN
      RAISE EXCEPTION 'Purchase (add) requires purchase_unit_ils';
    END IF;
  END IF;

  -- Lock the product row to prevent concurrent modifications
  SELECT quantity, COALESCE(cost, 0)
  INTO v_current_quantity, v_current_cost
  FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  v_new_quantity := v_current_quantity + p_quantity_changed;

  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_quantity, p_quantity_changed;
  END IF;

  IF p_action_type = 'add' AND p_quantity_changed > 0 THEN
    IF v_new_quantity > 0 THEN
      v_new_cost := ((v_current_quantity * v_current_cost) + (p_quantity_changed * p_purchase_unit_ils)) / v_new_quantity;
    ELSE
      v_new_cost := p_purchase_unit_ils;
    END IF;
  ELSE
    v_new_cost := v_current_cost;
  END IF;

  -- STEP 1: ledger entry (exactly once)
  INSERT INTO public.inventory_actions (
    id, business_id, user_id, product_id, action_type, quantity_changed, currency,
    sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent, cost_snapshot_ils,
    purchase_unit_ils, purchase_total_ils, supplier_id, notes, timestamp,
    source, reference_type, reference_id, reference_meta
  ) VALUES (
    gen_random_uuid(), p_business_id, v_actor, p_product_id, p_action_type, p_quantity_changed, 'ILS',
    CASE WHEN p_action_type = 'remove' THEN p_sale_total_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_sale_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_list_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_discount_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_discount_percent ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_cost_snapshot_ils ELSE NULL END,
    CASE WHEN p_action_type = 'add' THEN p_purchase_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'add' THEN p_purchase_total_ils ELSE NULL END,
    CASE WHEN p_action_type = 'add' THEN p_supplier_id ELSE NULL END,
    p_notes, now(),
    p_source, p_reference_type, p_reference_id, p_reference_meta
  )
  RETURNING id INTO v_action_id;

  -- STEP 2: apply stock/cost
  UPDATE public.products
  SET quantity = v_new_quantity,
      cost = v_new_cost,
      updated_at = now()
  WHERE id = p_product_id AND business_id = p_business_id;

  v_result := jsonb_build_object(
    'success', true,
    'action_id', v_action_id,
    'product_id', p_product_id,
    'action_type', p_action_type,
    'old_quantity', v_current_quantity,
    'new_quantity', v_new_quantity,
    'old_cost', v_current_cost,
    'new_cost', v_new_cost,
    'quantity_changed', p_quantity_changed
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_inventory_transaction(
  uuid, uuid, uuid, text, integer, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_inventory_transaction(
  uuid, uuid, uuid, text, integer, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, uuid, text, text, text, uuid, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Shortage resolution on import order items
-- ---------------------------------------------------------------------
ALTER TABLE public.import_order_items
  ADD COLUMN IF NOT EXISTS not_arriving_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortage_resolution text NOT NULL DEFAULT 'still_expected',
  ADD COLUMN IF NOT EXISTS shortage_notes text,
  ADD COLUMN IF NOT EXISTS shortage_resolved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS shortage_resolved_by uuid;

ALTER TABLE public.import_order_items
  DROP CONSTRAINT IF EXISTS import_order_items_not_arriving_quantity_check;
ALTER TABLE public.import_order_items
  ADD CONSTRAINT import_order_items_not_arriving_quantity_check
  CHECK (not_arriving_quantity >= 0);

ALTER TABLE public.import_order_items
  DROP CONSTRAINT IF EXISTS import_order_items_shortage_resolution_check;
ALTER TABLE public.import_order_items
  ADD CONSTRAINT import_order_items_shortage_resolution_check
  CHECK (shortage_resolution IN ('still_expected','supplier_shortage','cancelled','credited','other'));

-- ---------------------------------------------------------------------
-- 4. Receiving domain tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','confirmed','cancelled')),
  receiving_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jerusalem')::date),
  notes text,
  created_by uuid NOT NULL,
  confirmed_at timestamp with time zone,
  confirmed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.import_receipts TO authenticated;
GRANT ALL ON public.import_receipts TO service_role;
ALTER TABLE public.import_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Import managers can view receipts" ON public.import_receipts;
CREATE POLICY "Import managers can view receipts"
  ON public.import_receipts FOR SELECT TO authenticated
  USING (public.can_manage_business_imports(business_id, auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_receipts_single_draft
  ON public.import_receipts (import_order_id) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_import_receipts_order
  ON public.import_receipts (import_order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.import_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  import_receipt_id uuid NOT NULL REFERENCES public.import_receipts(id) ON DELETE CASCADE,
  import_order_item_id uuid NOT NULL REFERENCES public.import_order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  notes text,
  inventory_action_id uuid UNIQUE REFERENCES public.inventory_actions(id),
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (import_receipt_id, import_order_item_id)
);

GRANT SELECT ON public.import_receipt_items TO authenticated;
GRANT ALL ON public.import_receipt_items TO service_role;
ALTER TABLE public.import_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Import managers can view receipt items" ON public.import_receipt_items;
CREATE POLICY "Import managers can view receipt items"
  ON public.import_receipt_items FOR SELECT TO authenticated
  USING (public.can_manage_business_imports(business_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_receipt_items_receipt
  ON public.import_receipt_items (import_receipt_id);

CREATE TABLE IF NOT EXISTS public.import_receipt_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  import_receipt_id uuid NOT NULL REFERENCES public.import_receipts(id) ON DELETE CASCADE,
  import_receipt_item_id uuid NOT NULL REFERENCES public.import_receipt_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reason text NOT NULL,
  inventory_action_id uuid UNIQUE REFERENCES public.inventory_actions(id),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.import_receipt_corrections TO authenticated;
GRANT ALL ON public.import_receipt_corrections TO service_role;
ALTER TABLE public.import_receipt_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Import managers can view receipt corrections" ON public.import_receipt_corrections;
CREATE POLICY "Import managers can view receipt corrections"
  ON public.import_receipt_corrections FOR SELECT TO authenticated
  USING (public.can_manage_business_imports(business_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_receipt_corrections_receipt
  ON public.import_receipt_corrections (import_receipt_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 5. Tenant-consistency + updated_at triggers
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_import_receipts_tenant ON public.import_receipts;
CREATE TRIGGER trg_import_receipts_tenant
  BEFORE INSERT OR UPDATE ON public.import_receipts
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();

DROP TRIGGER IF EXISTS trg_import_receipt_corrections_tenant ON public.import_receipt_corrections;
CREATE TRIGGER trg_import_receipt_corrections_tenant
  BEFORE INSERT OR UPDATE ON public.import_receipt_corrections
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();

DROP TRIGGER IF EXISTS trg_import_receipts_updated ON public.import_receipts;
CREATE TRIGGER trg_import_receipts_updated
  BEFORE UPDATE ON public.import_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_import_receipt_items_updated ON public.import_receipt_items;
CREATE TRIGGER trg_import_receipt_items_updated
  BEFORE UPDATE ON public.import_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- receipt items: parent receipt + product must be same tenant
CREATE OR REPLACE FUNCTION public.import_receipt_item_enforce_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_bid uuid; v_status text; v_item_bid uuid;
BEGIN
  SELECT business_id, status INTO v_bid, v_status
  FROM public.import_receipts WHERE id = NEW.import_receipt_id;
  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  IF NEW.business_id IS DISTINCT FROM v_bid THEN
    RAISE EXCEPTION 'business_id does not match the parent receipt';
  END IF;

  SELECT business_id INTO v_item_bid
  FROM public.import_order_items WHERE id = NEW.import_order_item_id;
  IF v_item_bid IS DISTINCT FROM v_bid THEN
    RAISE EXCEPTION 'Import order item belongs to a different business';
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT business_id INTO v_item_bid FROM public.products WHERE id = NEW.product_id;
    IF v_item_bid IS DISTINCT FROM v_bid THEN
      RAISE EXCEPTION 'Product belongs to a different business';
    END IF;
  END IF;

  -- quantities of a confirmed receipt are immutable (corrections only)
  IF TG_OP = 'UPDATE' AND v_status = 'confirmed'
     AND NEW.received_quantity IS DISTINCT FROM OLD.received_quantity THEN
    RAISE EXCEPTION 'Confirmed receipt quantities cannot be edited — use a correction';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_import_receipt_items_tenant ON public.import_receipt_items;
CREATE TRIGGER trg_import_receipt_items_tenant
  BEFORE INSERT OR UPDATE ON public.import_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.import_receipt_item_enforce_tenant();

-- ---------------------------------------------------------------------
-- 6. Receiving RPCs (the only write path)
-- ---------------------------------------------------------------------

-- 6a. start / resume a draft receipt
CREATE OR REPLACE FUNCTION public.import_receipt_start(p_import_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_order public.import_orders;
  v_receipt_id uuid;
  v_seq integer;
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
  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Import order is closed';
  END IF;

  SELECT id INTO v_receipt_id
  FROM public.import_receipts
  WHERE import_order_id = p_import_order_id AND status = 'draft'
  LIMIT 1;

  IF v_receipt_id IS NOT NULL THEN
    RETURN v_receipt_id;
  END IF;

  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.import_receipts WHERE import_order_id = p_import_order_id;

  INSERT INTO public.import_receipts (business_id, import_order_id, receipt_number, created_by)
  VALUES (v_order.business_id, p_import_order_id,
          v_order.import_number || '-R' || lpad(v_seq::text, 2, '0'), v_caller)
  RETURNING id INTO v_receipt_id;

  IF v_order.status NOT IN ('receiving', 'received_pending_costs') THEN
    UPDATE public.import_orders SET status = 'receiving', updated_at = now()
    WHERE id = p_import_order_id;
  END IF;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (p_import_order_id, v_order.business_id, 'receiving_started', v_caller,
          jsonb_build_object('receipt_id', v_receipt_id));

  RETURN v_receipt_id;
END;
$function$;

-- 6b. save draft quantities — NEVER touches inventory
CREATE OR REPLACE FUNCTION public.import_receipt_save_draft(
  p_receipt_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_receipt public.import_receipts;
  v_line jsonb;
  v_item_id uuid;
  v_qty integer;
  v_saved integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_receipt FROM public.import_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  IF NOT public.can_manage_business_imports(v_receipt.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF v_receipt.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft receipts can be edited';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_item_id := (v_line->>'import_order_item_id')::uuid;
    v_qty := GREATEST(COALESCE((v_line->>'received_quantity')::integer, 0), 0);

    PERFORM 1 FROM public.import_order_items
    WHERE id = v_item_id
      AND import_order_id = v_receipt.import_order_id
      AND business_id = v_receipt.business_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item does not belong to this import order';
    END IF;

    INSERT INTO public.import_receipt_items
      (business_id, import_receipt_id, import_order_item_id, received_quantity, notes)
    VALUES (v_receipt.business_id, p_receipt_id, v_item_id, v_qty, NULLIF(v_line->>'notes', ''))
    ON CONFLICT (import_receipt_id, import_order_item_id)
    DO UPDATE SET received_quantity = EXCLUDED.received_quantity,
                  notes = EXCLUDED.notes,
                  updated_at = now();
    v_saved := v_saved + 1;
  END LOOP;

  UPDATE public.import_receipts
  SET receiving_date = COALESCE((p_lines #>> '{}')::text::date, receiving_date)
  WHERE FALSE; -- no-op guard, receiving_date is edited separately

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_receipt.import_order_id, v_receipt.business_id, 'receipt_draft_saved', v_caller,
          jsonb_build_object('receipt_id', p_receipt_id, 'lines', v_saved));

  RETURN jsonb_build_object('success', true, 'lines', v_saved);
END;
$function$;

-- 6c. ATOMIC confirmation — the only path that mutates stock
CREATE OR REPLACE FUNCTION public.import_receipt_confirm(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_receipt public.import_receipts;
  v_order public.import_orders;
  v_line record;
  v_unit_cost numeric;
  v_action jsonb;
  v_lines integer := 0;
  v_units integer := 0;
  v_shortages integer := 0;
  v_overages integer := 0;
  v_prod_bid uuid;
  v_open boolean;
  v_new_received integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- lock the receipt: serialises concurrent confirmations / double clicks
  SELECT * INTO v_receipt FROM public.import_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  IF NOT public.can_manage_business_imports(v_receipt.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF v_receipt.status <> 'draft' THEN
    RAISE EXCEPTION 'הקליטה כבר אושרה או בוטלה (%) — לא ניתן לאשר פעמיים', v_receipt.status
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_order FROM public.import_orders
  WHERE id = v_receipt.import_order_id AND business_id = v_receipt.business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import order does not match the receipt tenant';
  END IF;
  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Import order is closed';
  END IF;

  FOR v_line IN
    SELECT ri.id,
           ri.import_order_item_id,
           ri.received_quantity,
           oi.product_id AS item_product_id,
           oi.ordered_quantity,
           oi.received_quantity AS prev_received,
           oi.not_arriving_quantity,
           oi.expected_unit_cost_ils,
           oi.supplier_unit_cost,
           oi.product_description
    FROM public.import_receipt_items ri
    JOIN public.import_order_items oi ON oi.id = ri.import_order_item_id
    WHERE ri.import_receipt_id = p_receipt_id
      AND ri.received_quantity > 0
    ORDER BY ri.id
    FOR UPDATE OF ri, oi
  LOOP
    IF v_line.item_product_id IS NULL THEN
      RAISE EXCEPTION 'הפריט "%" אינו מקושר למוצר במלאי — יש לקשר או ליצור מוצר לפני אישור',
        v_line.product_description;
    END IF;

    SELECT business_id INTO v_prod_bid FROM public.products WHERE id = v_line.item_product_id;
    IF v_prod_bid IS DISTINCT FROM v_receipt.business_id THEN
      RAISE EXCEPTION 'Product belongs to a different business';
    END IF;

    -- Provisional GOODS cost only. Import overheads are NOT capitalised here;
    -- the final landed cost adjustment happens at Phase 3 order closure.
    v_unit_cost := COALESCE(
      v_line.expected_unit_cost_ils,
      v_line.supplier_unit_cost * COALESCE(v_order.working_exchange_rate_to_ils, 1)
    );

    v_action := public.execute_inventory_transaction(
      p_business_id      => v_receipt.business_id,
      p_user_id          => v_caller,
      p_product_id       => v_line.item_product_id,
      p_action_type      => 'add',
      p_quantity_changed => v_line.received_quantity,
      p_purchase_unit_ils  => v_unit_cost,
      p_purchase_total_ils => v_unit_cost * v_line.received_quantity,
      p_supplier_id      => v_order.supplier_id,
      p_notes            => 'קליטת יבוא ' || v_order.import_number || ' · ' || v_receipt.receipt_number,
      p_source           => 'import_receiving',
      p_reference_type   => 'import_receipt_item',
      p_reference_id     => v_line.id,
      p_reference_meta   => jsonb_build_object(
        'import_order_id', v_order.id,
        'import_number', v_order.import_number,
        'import_receipt_id', v_receipt.id,
        'receipt_number', v_receipt.receipt_number,
        'import_order_item_id', v_line.import_order_item_id
      )
    );

    UPDATE public.import_receipt_items
    SET inventory_action_id = (v_action->>'action_id')::uuid,
        product_id = v_line.item_product_id,
        applied_at = now(),
        updated_at = now()
    WHERE id = v_line.id;

    v_new_received := v_line.prev_received + v_line.received_quantity;

    UPDATE public.import_order_items
    SET received_quantity = v_new_received,
        item_status = CASE
          WHEN v_new_received + not_arriving_quantity >= ordered_quantity THEN 'received'
          ELSE 'partially_received' END,
        updated_at = now()
    WHERE id = v_line.import_order_item_id;

    v_lines := v_lines + 1;
    v_units := v_units + v_line.received_quantity;

    IF v_new_received > v_line.ordered_quantity THEN
      v_overages := v_overages + 1;
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (v_order.id, v_order.business_id, 'receipt_overage_recorded', v_caller,
              jsonb_build_object('receipt_id', v_receipt.id,
                                 'import_order_item_id', v_line.import_order_item_id,
                                 'ordered', v_line.ordered_quantity,
                                 'received_total', v_new_received,
                                 'overage', v_new_received - v_line.ordered_quantity));
    ELSIF v_new_received + v_line.not_arriving_quantity < v_line.ordered_quantity THEN
      v_shortages := v_shortages + 1;
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (v_order.id, v_order.business_id, 'receipt_shortage_recorded', v_caller,
              jsonb_build_object('receipt_id', v_receipt.id,
                                 'import_order_item_id', v_line.import_order_item_id,
                                 'ordered', v_line.ordered_quantity,
                                 'received_total', v_new_received,
                                 'shortage', v_line.ordered_quantity - v_new_received - v_line.not_arriving_quantity));
    END IF;
  END LOOP;

  IF v_lines = 0 THEN
    RAISE EXCEPTION 'אין כמויות לקליטה — יש להזין לפחות שורה אחת';
  END IF;

  UPDATE public.import_receipts
  SET status = 'confirmed', confirmed_at = now(), confirmed_by = v_caller, updated_at = now()
  WHERE id = p_receipt_id;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_order.id, v_order.business_id, 'receipt_confirmed', v_caller,
          jsonb_build_object('receipt_id', v_receipt.id,
                             'receipt_number', v_receipt.receipt_number,
                             'lines', v_lines, 'units', v_units,
                             'shortage_lines', v_shortages, 'overage_lines', v_overages));

  SELECT EXISTS (
    SELECT 1 FROM public.import_order_items
    WHERE import_order_id = v_order.id
      AND item_status <> 'cancelled'
      AND GREATEST(ordered_quantity - received_quantity - not_arriving_quantity, 0) > 0
  ) INTO v_open;

  UPDATE public.import_orders
  SET status = CASE WHEN v_open THEN 'receiving' ELSE 'received_pending_costs' END,
      updated_at = now()
  WHERE id = v_order.id AND status NOT IN ('completed', 'cancelled');

  RETURN jsonb_build_object('success', true, 'receipt_id', v_receipt.id,
                            'lines', v_lines, 'units', v_units,
                            'order_status', CASE WHEN v_open THEN 'receiving' ELSE 'received_pending_costs' END);
END;
$function$;

-- 6d. cancel an unwanted draft
CREATE OR REPLACE FUNCTION public.import_receipt_cancel_draft(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_receipt public.import_receipts; v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_receipt FROM public.import_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF NOT public.can_manage_business_imports(v_receipt.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF v_receipt.status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be cancelled'; END IF;
  UPDATE public.import_receipts SET status = 'cancelled', updated_at = now() WHERE id = p_receipt_id;
END;
$function$;

-- 6e. post-confirmation correction (never edits history)
CREATE OR REPLACE FUNCTION public.import_receipt_correct(
  p_receipt_item_id uuid,
  p_quantity_delta integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_ri record;
  v_receipt public.import_receipts;
  v_order public.import_orders;
  v_unit_cost numeric;
  v_action jsonb;
  v_correction_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_quantity_delta = 0 THEN RAISE EXCEPTION 'Correction quantity must not be zero'; END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'Correction reason is required'; END IF;

  SELECT ri.*, oi.product_id AS item_product_id, oi.ordered_quantity,
         oi.received_quantity AS item_received, oi.not_arriving_quantity,
         oi.expected_unit_cost_ils, oi.supplier_unit_cost
  INTO v_ri
  FROM public.import_receipt_items ri
  JOIN public.import_order_items oi ON oi.id = ri.import_order_item_id
  WHERE ri.id = p_receipt_item_id
  FOR UPDATE OF ri, oi;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt line not found'; END IF;

  SELECT * INTO v_receipt FROM public.import_receipts WHERE id = v_ri.import_receipt_id FOR UPDATE;
  IF NOT public.can_manage_business_imports(v_receipt.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF v_receipt.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed receipts can be corrected';
  END IF;

  SELECT * INTO v_order FROM public.import_orders WHERE id = v_receipt.import_order_id FOR UPDATE;

  IF v_ri.item_product_id IS NULL THEN RAISE EXCEPTION 'Receipt line is not linked to a product'; END IF;
  IF v_ri.item_received + p_quantity_delta < 0 THEN
    RAISE EXCEPTION 'Correction would make the received quantity negative';
  END IF;

  v_unit_cost := COALESCE(
    v_ri.expected_unit_cost_ils,
    v_ri.supplier_unit_cost * COALESCE(v_order.working_exchange_rate_to_ils, 1)
  );

  IF p_quantity_delta > 0 THEN
    v_action := public.execute_inventory_transaction(
      p_business_id => v_receipt.business_id, p_user_id => v_caller,
      p_product_id => v_ri.item_product_id, p_action_type => 'add',
      p_quantity_changed => p_quantity_delta,
      p_purchase_unit_ils => v_unit_cost,
      p_purchase_total_ils => v_unit_cost * p_quantity_delta,
      p_supplier_id => v_order.supplier_id,
      p_notes => 'תיקון קליטת יבוא ' || v_receipt.receipt_number || ' · ' || p_reason,
      p_source => 'import_receiving_correction',
      p_reference_type => 'import_receipt_item',
      p_reference_id => v_ri.id,
      p_reference_meta => jsonb_build_object('import_order_id', v_order.id,
        'import_number', v_order.import_number, 'import_receipt_id', v_receipt.id,
        'receipt_number', v_receipt.receipt_number, 'reason', p_reason)
    );
  ELSE
    -- financially neutral reduction: never recorded as a sale
    v_action := public.execute_inventory_transaction(
      p_business_id => v_receipt.business_id, p_user_id => v_caller,
      p_product_id => v_ri.item_product_id, p_action_type => 'adjust',
      p_quantity_changed => p_quantity_delta,
      p_notes => 'תיקון קליטת יבוא ' || v_receipt.receipt_number || ' · ' || p_reason,
      p_source => 'import_receiving_correction',
      p_reference_type => 'import_receipt_item',
      p_reference_id => v_ri.id,
      p_reference_meta => jsonb_build_object('import_order_id', v_order.id,
        'import_number', v_order.import_number, 'import_receipt_id', v_receipt.id,
        'receipt_number', v_receipt.receipt_number, 'reason', p_reason)
    );
  END IF;

  INSERT INTO public.import_receipt_corrections
    (business_id, import_order_id, import_receipt_id, import_receipt_item_id,
     product_id, quantity_delta, reason, inventory_action_id, created_by)
  VALUES (v_receipt.business_id, v_order.id, v_receipt.id, v_ri.id,
          v_ri.item_product_id, p_quantity_delta, p_reason,
          (v_action->>'action_id')::uuid, v_caller)
  RETURNING id INTO v_correction_id;

  UPDATE public.import_order_items
  SET received_quantity = v_ri.item_received + p_quantity_delta,
      item_status = CASE
        WHEN v_ri.item_received + p_quantity_delta + not_arriving_quantity >= ordered_quantity THEN 'received'
        WHEN v_ri.item_received + p_quantity_delta > 0 THEN 'partially_received'
        ELSE 'pending' END,
      updated_at = now()
  WHERE id = v_ri.import_order_item_id;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_order.id, v_order.business_id, 'receipt_corrected', v_caller,
          jsonb_build_object('receipt_id', v_receipt.id, 'receipt_item_id', v_ri.id,
                             'delta', p_quantity_delta, 'reason', p_reason,
                             'correction_id', v_correction_id));

  RETURN jsonb_build_object('success', true, 'correction_id', v_correction_id,
                            'inventory_action_id', v_action->>'action_id');
END;
$function$;

-- 6f. shortage resolution
CREATE OR REPLACE FUNCTION public.import_item_resolve_shortage(
  p_item_id uuid,
  p_resolution text,
  p_quantity integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_item public.import_order_items;
  v_outstanding integer;
  v_qty integer;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_resolution NOT IN ('still_expected','supplier_shortage','cancelled','credited','other') THEN
    RAISE EXCEPTION 'Invalid resolution';
  END IF;

  SELECT * INTO v_item FROM public.import_order_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF NOT public.can_manage_business_imports(v_item.business_id, v_caller) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_outstanding := GREATEST(v_item.ordered_quantity - v_item.received_quantity, 0);

  IF p_resolution = 'still_expected' THEN
    v_qty := 0;                                  -- keeps counting as in transit
  ELSE
    v_qty := LEAST(GREATEST(COALESCE(p_quantity, v_outstanding), 0), v_outstanding);
  END IF;

  UPDATE public.import_order_items
  SET not_arriving_quantity = v_qty,
      shortage_resolution = p_resolution,
      shortage_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      shortage_resolved_at = now(),
      shortage_resolved_by = v_caller,
      item_status = CASE
        WHEN received_quantity + v_qty >= ordered_quantity THEN 'received'
        WHEN received_quantity > 0 THEN 'partially_received'
        ELSE 'pending' END,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_item.import_order_id, v_item.business_id, 'receipt_shortage_recorded', v_caller,
          jsonb_build_object('import_order_item_id', p_item_id,
                             'resolution', p_resolution,
                             'not_arriving_quantity', v_qty));

  RETURN jsonb_build_object('success', true, 'not_arriving_quantity', v_qty);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_receipt_start(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_receipt_save_draft(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_receipt_confirm(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_receipt_cancel_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_receipt_correct(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_item_resolve_shortage(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_receipt_start(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_receipt_save_draft(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_receipt_confirm(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_receipt_cancel_draft(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_receipt_correct(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_item_resolve_shortage(uuid, text, integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Quantity in transit — final business rule (quantity only)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_quantity_in_transit(
  p_business_id uuid, p_product_ids uuid[]
)
RETURNS TABLE(product_id uuid, quantity_in_transit bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- quantity-only read model: any active member of the tenant may see it.
  IF NOT (
    public.is_business_member(p_business_id, auth.uid())
    OR public.has_role_or_higher('admin'::user_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  IF array_length(p_product_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Too many product ids (max 100)';
  END IF;

  RETURN QUERY
  SELECT i.product_id,
         SUM(GREATEST(i.ordered_quantity - i.received_quantity - i.not_arriving_quantity, 0))::bigint
  FROM public.import_order_items i
  JOIN public.import_orders o ON o.id = i.import_order_id
  WHERE i.business_id = p_business_id
    AND i.product_id = ANY(p_product_ids)
    AND i.item_status <> 'cancelled'
    AND o.status NOT IN ('completed', 'cancelled')
  GROUP BY i.product_id
  HAVING SUM(GREATEST(i.ordered_quantity - i.received_quantity - i.not_arriving_quantity, 0)) > 0;
END;
$function$;