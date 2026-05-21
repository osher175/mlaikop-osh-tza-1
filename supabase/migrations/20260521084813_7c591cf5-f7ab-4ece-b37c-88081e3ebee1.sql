
-- STEP 1: Membership reconciliation
INSERT INTO public.user_businesses (user_id, business_id, role)
SELECT bu.user_id, bu.business_id, COALESCE(bu.role, 'MEMBER')
FROM public.business_users bu
WHERE bu.status = 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_businesses ub
    WHERE ub.user_id = bu.user_id AND ub.business_id = bu.business_id
  );

-- STEP 2: businesses billing fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_phone_e164 text NULL,
  ADD COLUMN IF NOT EXISTS business_identity_hash text NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_identity_hash
  ON public.businesses(business_identity_hash)
  WHERE business_identity_hash IS NOT NULL;

-- STEP 3: user_subscriptions business scope
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS business_id uuid NULL REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text NULL,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_business_id
  ON public.user_subscriptions(business_id);

UPDATE public.user_subscriptions us
SET business_id = b.id
FROM public.businesses b
WHERE us.business_id IS NULL
  AND b.owner_id = us.user_id
  AND (SELECT COUNT(*) FROM public.businesses b2 WHERE b2.owner_id = us.user_id) = 1;

-- STEP 4: relax status check
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'trial'::text,'active'::text,'restricted'::text,
    'past_due'::text,'cancelled'::text,'incomplete'::text,'expired'::text
  ]));

-- STEP 5: subscription_plans extensions
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text NULL,
  ADD COLUMN IF NOT EXISTS is_selectable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NULL,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly';

-- Repurpose existing plans (preserves FK references). Unique on role prevents duplicates.
UPDATE public.subscription_plans
SET name = 'Regular',
    monthly_price = 500,
    currency = 'ILS',
    billing_interval = 'monthly',
    is_selectable = true,
    is_active = true,
    display_order = 1
WHERE role = 'pro_starter_user';

UPDATE public.subscription_plans
SET name = 'Advanced',
    monthly_price = 800,
    currency = 'ILS',
    billing_interval = 'monthly',
    is_selectable = false,
    is_active = true,
    display_order = 2
WHERE role = 'smart_master_user';

-- STEP 6: reporting helper
CREATE OR REPLACE FUNCTION public.business_billing_status(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_status text;
  v_trial_ends timestamptz;
BEGIN
  SELECT owner_id INTO v_owner FROM public.businesses WHERE id = p_business_id;
  IF v_owner IS NULL THEN RETURN 'none'; END IF;

  SELECT status, trial_ends_at INTO v_status, v_trial_ends
  FROM public.user_subscriptions
  WHERE business_id = p_business_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_status IS NULL THEN
    SELECT status, trial_ends_at INTO v_status, v_trial_ends
    FROM public.user_subscriptions
    WHERE user_id = v_owner
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_status IS NULL THEN RETURN 'none'; END IF;
  IF v_status = 'active' THEN RETURN 'active'; END IF;
  IF v_status = 'past_due' THEN RETURN 'past_due'; END IF;
  IF v_status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_status = 'trial' THEN
    IF v_trial_ends IS NOT NULL AND v_trial_ends >= now() THEN RETURN 'trial';
    ELSE RETURN 'restricted'; END IF;
  END IF;
  IF v_status IN ('expired','restricted','incomplete') THEN RETURN 'restricted'; END IF;
  RETURN 'none';
END;
$$;
