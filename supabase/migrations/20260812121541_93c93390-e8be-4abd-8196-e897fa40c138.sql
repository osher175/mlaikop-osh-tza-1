CREATE OR REPLACE FUNCTION public.import_order_delete(p_order_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_business_id uuid;
  v_row public.import_pin_settings%ROWTYPE;
  v_confirmed int;
BEGIN
  SELECT business_id INTO v_business_id FROM public.import_orders WHERE id = p_order_id;
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Import order not found';
  END IF;

  IF NOT public.can_manage_business_imports(v_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.import_pin_settings WHERE business_id = v_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No PIN configured for this business';
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RAISE EXCEPTION 'Import module temporarily locked';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' OR extensions.crypt(p_pin, v_row.pin_hash) <> v_row.pin_hash THEN
    UPDATE public.import_pin_settings
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
          updated_at = now()
      WHERE business_id = v_business_id;
    RAISE EXCEPTION 'Invalid PIN' USING ERRCODE = '28000';
  END IF;

  UPDATE public.import_pin_settings
    SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE business_id = v_business_id;

  SELECT count(*) INTO v_confirmed
  FROM public.import_receipts
  WHERE import_order_id = p_order_id AND status = 'confirmed';

  IF v_confirmed > 0 THEN
    RAISE EXCEPTION 'Order has confirmed receipts and cannot be deleted';
  END IF;

  DELETE FROM public.import_receipt_corrections WHERE import_order_id = p_order_id;
  DELETE FROM public.import_receipt_items
    WHERE import_receipt_id IN (SELECT id FROM public.import_receipts WHERE import_order_id = p_order_id);
  DELETE FROM public.import_receipts WHERE import_order_id = p_order_id;
  DELETE FROM public.import_cost_adjustments
    WHERE import_cost_id IN (SELECT id FROM public.import_costs WHERE import_order_id = p_order_id);
  DELETE FROM public.import_costs WHERE import_order_id = p_order_id;
  DELETE FROM public.import_payments WHERE import_order_id = p_order_id;
  DELETE FROM public.import_documents WHERE import_order_id = p_order_id;
  DELETE FROM public.import_order_items WHERE import_order_id = p_order_id;
  DELETE FROM public.import_events WHERE import_order_id = p_order_id;
  DELETE FROM public.import_orders WHERE id = p_order_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_order_delete(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.import_order_delete(uuid, text) TO authenticated;