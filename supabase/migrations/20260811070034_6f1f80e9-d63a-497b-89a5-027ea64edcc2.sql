CREATE OR REPLACE FUNCTION public.import_enforce_related_tenant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_bid uuid;
BEGIN
  IF TG_TABLE_NAME = 'import_orders' THEN
    IF NEW.supplier_id IS NOT NULL THEN
      SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.supplier_id;
      IF v_bid IS DISTINCT FROM NEW.business_id THEN
        RAISE EXCEPTION 'Supplier belongs to a different business';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'import_order_items' THEN
    IF NEW.product_id IS NOT NULL THEN
      SELECT business_id INTO v_bid FROM public.products WHERE id = NEW.product_id;
      IF v_bid IS DISTINCT FROM NEW.business_id THEN
        RAISE EXCEPTION 'Product belongs to a different business';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'import_costs' THEN
    IF NEW.service_provider_supplier_id IS NOT NULL THEN
      SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.service_provider_supplier_id;
      IF v_bid IS DISTINCT FROM NEW.business_id THEN
        RAISE EXCEPTION 'Supplier belongs to a different business';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'import_payments' THEN
    IF NEW.payee_supplier_id IS NOT NULL THEN
      SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.payee_supplier_id;
      IF v_bid IS DISTINCT FROM NEW.business_id THEN
        RAISE EXCEPTION 'Supplier belongs to a different business';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;