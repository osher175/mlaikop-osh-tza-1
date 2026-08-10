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

  INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
  VALUES (v_receipt.import_order_id, v_receipt.business_id, 'receipt_draft_saved', v_caller,
          jsonb_build_object('receipt_id', p_receipt_id, 'lines', v_saved));

  RETURN jsonb_build_object('success', true, 'lines', v_saved);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_receipt_save_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_receipt_save_draft(uuid, jsonb) TO authenticated, service_role;