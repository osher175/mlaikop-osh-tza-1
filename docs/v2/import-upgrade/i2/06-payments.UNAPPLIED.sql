-- UNAPPLIED. Do not execute until a separate approval.
-- Optional payment document, and a revoked balance function.
-- Does not change payment rows, generated ILS amounts, or the live client total.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.import_payments
  ADD COLUMN import_document_id uuid;

ALTER TABLE public.import_payments
  ADD CONSTRAINT i2_import_payments_document_fkey
    FOREIGN KEY (business_id, import_document_id)
    REFERENCES public.import_documents (business_id, id);

COMMENT ON COLUMN public.import_payments.import_document_id IS
  'Optional supporting document. Null on every existing payment. The document must belong to the same order. The guard returns immediately when the column is null, so a legacy payment update is unchanged.';

CREATE OR REPLACE FUNCTION public.i2_payment_document_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_order uuid;
BEGIN
  IF NEW.import_document_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT import_order_id INTO v_order
  FROM public.import_documents
  WHERE id = NEW.import_document_id
    AND business_id = NEW.business_id;
  IF v_order IS DISTINCT FROM NEW.import_order_id THEN
    RAISE EXCEPTION 'payment document belongs to a different order' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_import_payments_document_guard
  BEFORE INSERT OR UPDATE ON public.import_payments
  FOR EACH ROW EXECUTE FUNCTION public.i2_payment_document_guard();

CREATE OR REPLACE FUNCTION public.import_supplier_balance(p_import_order_id uuid)
RETURNS TABLE (
  business_id uuid,
  import_order_id uuid,
  currency_code text,
  goods_amount numeric,
  paid_amount numeric,
  balance_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_business uuid;
  v_currency text;
  v_commercial text;
BEGIN
  SELECT o.business_id, o.currency_code, o.commercial_status
    INTO v_business, v_currency, v_commercial
  FROM public.import_orders o
  WHERE o.id = p_import_order_id;

  IF v_business IS NULL
     OR auth.uid() IS NULL
     OR public.is_business_member(v_business, auth.uid()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  business_id := v_business;
  import_order_id := p_import_order_id;
  currency_code := v_currency;

  IF v_commercial = 'confirmed' THEN
    SELECT COALESCE(SUM(i.supplier_unit_cost * i.ordered_quantity), 0)
      INTO goods_amount
    FROM public.import_order_items i
    WHERE i.import_order_id = p_import_order_id
      AND i.business_id = v_business
      AND i.currency_code = v_currency;
  ELSE
    goods_amount := 0;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
    INTO paid_amount
  FROM public.import_payments p
  WHERE p.import_order_id = p_import_order_id
    AND p.business_id = v_business
    AND p.payment_status = 'paid'
    AND p.import_cost_id IS NULL
    AND p.currency_code = v_currency
    AND p.payment_type IN ('deposit', 'balance', 'partial', 'supplier_payment');

  balance_amount := goods_amount - paid_amount;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION public.import_supplier_balance(uuid) IS
  'Supplier balance in the order currency. Uses payment.amount, never the generated ILS column. planned, pending, cancelled, expense, and foreign-currency payments do not reduce it. Revoked until I4. The live screen total is unchanged.';

REVOKE ALL ON FUNCTION public.import_supplier_balance(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_payment_document_guard()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.i2_payment_document_guard() TO authenticated;

COMMIT;
