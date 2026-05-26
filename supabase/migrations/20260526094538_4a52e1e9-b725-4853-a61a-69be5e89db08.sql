ALTER TABLE public.payment_sessions DROP CONSTRAINT IF EXISTS payment_sessions_provider_check;
ALTER TABLE public.payment_sessions ADD CONSTRAINT payment_sessions_provider_check
  CHECK (payment_provider = ANY (ARRAY['meshulam'::text, 'tranzila'::text, 'stripe'::text, 'manual'::text, 'grow'::text]));