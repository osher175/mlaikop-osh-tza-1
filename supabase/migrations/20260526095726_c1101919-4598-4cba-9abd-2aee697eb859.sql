-- 1. Add is_test column + tag the existing test row
ALTER TABLE public.payment_sessions
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

UPDATE public.payment_sessions
  SET is_test = true
  WHERE id = '11111111-2222-3333-4444-555555555555';

CREATE INDEX IF NOT EXISTS idx_payment_sessions_live
  ON public.payment_sessions(business_id) WHERE is_test = false;

-- 2. Safe "live" views for future consumers
CREATE OR REPLACE VIEW public.payment_sessions_live AS
  SELECT * FROM public.payment_sessions WHERE is_test = false;

CREATE OR REPLACE VIEW public.billing_events_live AS
  SELECT * FROM public.billing_events
  WHERE COALESCE((metadata->>'is_test')::boolean, false) = false;

-- 3. Admin-only safe cleanup RPC
CREATE OR REPLACE FUNCTION public.delete_test_payment_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_is_test boolean;
BEGIN
  IF NOT has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT is_test INTO v_is_test FROM payment_sessions WHERE id = p_session_id;
  IF v_is_test IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'refuse to delete non-test session %', p_session_id;
  END IF;

  DELETE FROM billing_events WHERE metadata->>'session_id' = p_session_id::text;
  DELETE FROM payment_sessions WHERE id = p_session_id AND is_test = true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_payment_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_payment_session(uuid) TO authenticated;