-- UNAPPLIED. Do not execute until a separate approval.
-- Additive unique keys so later files can reject a cross-business foreign key.
-- Does not rewrite rows, drop columns, or change existing privileges.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE UNIQUE INDEX i2_products_business_id_id_key
  ON public.products (business_id, id);
CREATE UNIQUE INDEX i2_suppliers_business_id_id_key
  ON public.suppliers (business_id, id);
CREATE UNIQUE INDEX i2_import_orders_business_id_id_key
  ON public.import_orders (business_id, id);
CREATE UNIQUE INDEX i2_import_order_items_business_id_id_key
  ON public.import_order_items (business_id, id);
CREATE UNIQUE INDEX i2_import_costs_business_id_id_key
  ON public.import_costs (business_id, id);
CREATE UNIQUE INDEX i2_import_documents_business_id_id_key
  ON public.import_documents (business_id, id);
CREATE UNIQUE INDEX i2_purchase_orders_business_id_id_key
  ON public.purchase_orders (business_id, id);
CREATE UNIQUE INDEX i2_purchase_order_lines_business_id_id_key
  ON public.purchase_order_lines (business_id, id);

-- Read predicate for new tables. Always uses auth.uid().
-- Does not call can_manage_business_imports and does not read user_roles.
CREATE OR REPLACE FUNCTION public.import_upgrade_is_member(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
  SELECT public.is_business_member(_business_id, auth.uid()) IS TRUE;
$fn$;

REVOKE ALL ON FUNCTION public.import_upgrade_is_member(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.import_upgrade_is_member(uuid) TO authenticated;

COMMENT ON FUNCTION public.import_upgrade_is_member(uuid) IS
  'I2 read predicate. Membership of auth.uid() only. Platform-admin bypass is intentionally absent.';

COMMIT;
