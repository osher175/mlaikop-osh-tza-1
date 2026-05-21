
-- ============================================================
-- 1. Provider columns on user_subscriptions
-- ============================================================
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_provider text NULL,
  ADD COLUMN IF NOT EXISTS provider_customer_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_subscription_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_payment_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_status text NULL,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_payment_provider_check'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_payment_provider_check
      CHECK (payment_provider IS NULL OR payment_provider IN ('meshulam','tranzila','stripe','manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_sub
  ON public.user_subscriptions(payment_provider, provider_subscription_id);

-- ============================================================
-- 2. Provider columns on subscription_plans
-- ============================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS payment_provider text NULL,
  ADD COLUMN IF NOT EXISTS provider_plan_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_price_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_payment_provider_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_payment_provider_check
      CHECK (payment_provider IS NULL OR payment_provider IN ('meshulam','tranzila','stripe','manual'));
  END IF;
END $$;

-- ============================================================
-- 3. payment_sessions table + RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  payment_provider text NOT NULL,
  provider_session_id text NULL,
  checkout_url text NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  expires_at timestamptz NULL,
  CONSTRAINT payment_sessions_provider_check
    CHECK (payment_provider IN ('meshulam','tranzila','stripe','manual')),
  CONSTRAINT payment_sessions_status_check
    CHECK (status IN ('pending','completed','failed','expired','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_business
  ON public.payment_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status
  ON public.payment_sessions(status);

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_sessions_select ON public.payment_sessions;
CREATE POLICY payment_sessions_select ON public.payment_sessions
  FOR SELECT TO authenticated
  USING (
    public.has_role_or_higher('admin'::user_role)
    OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS payment_sessions_insert ON public.payment_sessions;
CREATE POLICY payment_sessions_insert ON public.payment_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_role_or_higher('admin'::user_role)
      OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS payment_sessions_service_update ON public.payment_sessions;
CREATE POLICY payment_sessions_service_update ON public.payment_sessions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payment_sessions_admin_update ON public.payment_sessions;
CREATE POLICY payment_sessions_admin_update ON public.payment_sessions
  FOR UPDATE TO authenticated
  USING (public.has_role_or_higher('admin'::user_role))
  WITH CHECK (public.has_role_or_higher('admin'::user_role));

-- ============================================================
-- 4. Provider status mapping function
-- ============================================================
CREATE OR REPLACE FUNCTION public.map_provider_status(
  p_provider text,
  p_provider_status text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(p_provider_status,''))
    WHEN 'paid' THEN 'active'
    WHEN 'active' THEN 'active'
    WHEN 'success' THEN 'active'
    WHEN 'completed' THEN 'active'
    WHEN 'trial' THEN 'trial'
    WHEN 'trialing' THEN 'trial'
    WHEN 'pending' THEN 'incomplete'
    WHEN 'incomplete' THEN 'incomplete'
    WHEN 'failed' THEN 'past_due'
    WHEN 'payment_failed' THEN 'past_due'
    WHEN 'declined' THEN 'past_due'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'expired' THEN 'restricted'
    ELSE 'incomplete'
  END;
$$;

-- ============================================================
-- 5. Generic upsert RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_business_subscription_from_provider(
  p_business_id uuid,
  p_user_id uuid,
  p_plan_id uuid,
  p_payment_provider text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_payment_id text,
  p_provider_status text,
  p_status text,
  p_current_period_end timestamptz,
  p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_old_status text;
  v_new_status text := coalesce(p_status, 'incomplete');
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'business_id required';
  END IF;

  -- Locate existing row: prefer (business_id + provider_subscription_id); else latest by business
  IF p_provider_subscription_id IS NOT NULL THEN
    SELECT id, status INTO v_id, v_old_status
    FROM public.user_subscriptions
    WHERE business_id = p_business_id
      AND provider_subscription_id = p_provider_subscription_id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT id, status INTO v_id, v_old_status
    FROM public.user_subscriptions
    WHERE business_id = p_business_id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.user_subscriptions(
      business_id, user_id, plan_id,
      payment_provider, provider_customer_id, provider_subscription_id,
      provider_payment_id, provider_status, status,
      current_period_end, next_billing_date,
      subscription_started_at, provider_metadata
    ) VALUES (
      p_business_id, p_user_id, p_plan_id,
      p_payment_provider, p_provider_customer_id, p_provider_subscription_id,
      p_provider_payment_id, p_provider_status, v_new_status,
      p_current_period_end, p_current_period_end,
      CASE WHEN v_new_status = 'active' THEN now() END,
      coalesce(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO v_id;
    v_old_status := 'none';
  ELSE
    UPDATE public.user_subscriptions SET
      user_id = coalesce(p_user_id, user_id),
      plan_id = coalesce(p_plan_id, plan_id),
      payment_provider = coalesce(p_payment_provider, payment_provider),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      provider_status = coalesce(p_provider_status, provider_status),
      status = v_new_status,
      current_period_end = coalesce(p_current_period_end, current_period_end),
      next_billing_date = coalesce(p_current_period_end, next_billing_date),
      subscription_started_at = CASE
        WHEN subscription_started_at IS NULL AND v_new_status = 'active' THEN now()
        ELSE subscription_started_at
      END,
      provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
    WHERE id = v_id;
  END IF;

  IF v_old_status IS DISTINCT FROM v_new_status THEN
    INSERT INTO public.billing_events(
      business_id, user_id, event_type, old_status, new_status, source, metadata
    ) VALUES (
      p_business_id, p_user_id,
      'provider_subscription_updated',
      v_old_status, v_new_status,
      coalesce(p_payment_provider, 'manual'),
      jsonb_build_object(
        'provider_subscription_id', p_provider_subscription_id,
        'provider_status', p_provider_status,
        'current_period_end', p_current_period_end
      )
    );
  END IF;

  RETURN v_id;
END;
$$;
