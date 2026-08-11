-- P1-A: draft save must fully replace the draft line set
CREATE OR REPLACE FUNCTION public.import_receipt_save_draft(p_receipt_id uuid, p_lines jsonb)
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
  v_keep uuid[] := ARRAY[]::uuid[];
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

    IF v_qty = 0 THEN
      CONTINUE;  -- zero lines are never persisted
    END IF;

    INSERT INTO public.import_receipt_items
      (business_id, import_receipt_id, import_order_item_id, received_quantity, notes)
    VALUES (v_receipt.business_id, p_receipt_id, v_item_id, v_qty, NULLIF(v_line->>'notes', ''))
    ON CONFLICT (import_receipt_id, import_order_item_id)
    DO UPDATE SET received_quantity = EXCLUDED.received_quantity,
                  notes = EXCLUDED.notes,
                  updated_at = now();
    v_keep := v_keep || v_item_id;
    v_saved := v_saved + 1;
  END LOOP;

  -- authoritative replace: any previously saved line no longer present is removed
  DELETE FROM public.import_receipt_items
  WHERE import_receipt_id = p_receipt_id
    AND applied_at IS NULL
    AND NOT (import_order_item_id = ANY (v_keep));

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_receipt.import_order_id, v_receipt.business_id, 'receipt_draft_saved', v_caller,
          jsonb_build_object('receipt_id', p_receipt_id, 'lines', v_saved));

  RETURN jsonb_build_object('success', true, 'lines', v_saved);
END;
$function$;

-- P1-B: product mapping becomes immutable once stock has actually been received
CREATE OR REPLACE FUNCTION public.import_item_lock_product_mapping()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    IF OLD.received_quantity > 0
       OR EXISTS (SELECT 1 FROM public.import_receipt_items ri
                  WHERE ri.import_order_item_id = OLD.id AND ri.applied_at IS NOT NULL) THEN
      RAISE EXCEPTION 'לא ניתן לשנות את המוצר המקושר לאחר שנקלטה סחורה לשורה זו'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_import_items_lock_mapping ON public.import_order_items;
CREATE TRIGGER trg_import_items_lock_mapping
BEFORE UPDATE ON public.import_order_items
FOR EACH ROW EXECUTE FUNCTION public.import_item_lock_product_mapping();