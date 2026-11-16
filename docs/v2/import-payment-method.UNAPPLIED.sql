-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- import_payments already stores date, amount, currency, supplier, reference,
-- status and partial payment types. This adds the payment method and a
-- request id so the same form submission cannot be inserted twice.
-- Recording a payment still does not change stock and is not an expense line.
-- The current client does not send payment_method or client_request_id.
-- After this file is applied, a later client deploy must send client_request_id
-- on insert. Until then, a double submit is stopped only while the button is pending.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.import_payments
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.import_payments
  DROP CONSTRAINT IF EXISTS import_payments_method_check;
ALTER TABLE public.import_payments
  ADD CONSTRAINT import_payments_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'check', 'credit', 'other'));

ALTER TABLE public.import_payments
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_payments_client_request
  ON public.import_payments (business_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.import_payments.payment_method IS
  'How the payment was made. Null on rows written before this column. Not a profit-and-loss expense.';

COMMIT;
