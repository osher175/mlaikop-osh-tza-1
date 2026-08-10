
-- 1. Cross-tenant reference validation ------------------------------------
CREATE OR REPLACE FUNCTION public.import_enforce_related_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_bid uuid;
BEGIN
  IF TG_TABLE_NAME = 'import_orders' AND NEW.supplier_id IS NOT NULL THEN
    SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.supplier_id;
    IF v_bid IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Supplier belongs to a different business';
    END IF;
  ELSIF TG_TABLE_NAME = 'import_order_items' AND NEW.product_id IS NOT NULL THEN
    SELECT business_id INTO v_bid FROM public.products WHERE id = NEW.product_id;
    IF v_bid IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Product belongs to a different business';
    END IF;
  ELSIF TG_TABLE_NAME = 'import_costs' AND NEW.service_provider_supplier_id IS NOT NULL THEN
    SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.service_provider_supplier_id;
    IF v_bid IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Supplier belongs to a different business';
    END IF;
  ELSIF TG_TABLE_NAME = 'import_payments' AND NEW.payee_supplier_id IS NOT NULL THEN
    SELECT business_id INTO v_bid FROM public.suppliers WHERE id = NEW.payee_supplier_id;
    IF v_bid IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Supplier belongs to a different business';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_orders_related_tenant ON public.import_orders;
CREATE TRIGGER trg_import_orders_related_tenant
BEFORE INSERT OR UPDATE ON public.import_orders
FOR EACH ROW EXECUTE FUNCTION public.import_enforce_related_tenant();

DROP TRIGGER IF EXISTS trg_import_items_related_tenant ON public.import_order_items;
CREATE TRIGGER trg_import_items_related_tenant
BEFORE INSERT OR UPDATE ON public.import_order_items
FOR EACH ROW EXECUTE FUNCTION public.import_enforce_related_tenant();

DROP TRIGGER IF EXISTS trg_import_costs_related_tenant ON public.import_costs;
CREATE TRIGGER trg_import_costs_related_tenant
BEFORE INSERT OR UPDATE ON public.import_costs
FOR EACH ROW EXECUTE FUNCTION public.import_enforce_related_tenant();

DROP TRIGGER IF EXISTS trg_import_payments_related_tenant ON public.import_payments;
CREATE TRIGGER trg_import_payments_related_tenant
BEFORE INSERT OR UPDATE ON public.import_payments
FOR EACH ROW EXECUTE FUNCTION public.import_enforce_related_tenant();

-- 2. Defense in depth: no anon grants on import tables ---------------------
REVOKE ALL ON public.import_orders FROM anon;
REVOKE ALL ON public.import_order_items FROM anon;
REVOKE ALL ON public.import_costs FROM anon;
REVOKE ALL ON public.import_payments FROM anon;
REVOKE ALL ON public.import_documents FROM anon;
REVOKE ALL ON public.import_events FROM anon;
REVOKE ALL ON public.import_pin_settings FROM anon;
REVOKE ALL ON public.import_pin_sessions FROM anon;
REVOKE ALL ON public.import_pin_settings FROM authenticated;
REVOKE ALL ON public.import_pin_sessions FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_costs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_documents TO authenticated;
GRANT SELECT ON public.import_events TO authenticated;
GRANT ALL ON public.import_orders TO service_role;
GRANT ALL ON public.import_order_items TO service_role;
GRANT ALL ON public.import_costs TO service_role;
GRANT ALL ON public.import_payments TO service_role;
GRANT ALL ON public.import_documents TO service_role;
GRANT ALL ON public.import_events TO service_role;
GRANT ALL ON public.import_pin_settings TO service_role;
GRANT ALL ON public.import_pin_sessions TO service_role;
