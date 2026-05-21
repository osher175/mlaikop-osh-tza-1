
-- ============================================================
-- 1. Orphan handling: admin_note column + mark orphans
-- ============================================================
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS admin_note text NULL;

UPDATE public.user_subscriptions
SET admin_note = 'orphaned_subscription_no_owned_business_after_billing_migration'
WHERE business_id IS NULL
  AND (admin_note IS NULL OR admin_note = '');

-- ============================================================
-- 2. billing_events table + RLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  user_id uuid NULL,
  event_type text NOT NULL,
  old_status text NULL,
  new_status text NULL,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_business_id
  ON public.billing_events(business_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at
  ON public.billing_events(created_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_events_select ON public.billing_events;
CREATE POLICY billing_events_select ON public.billing_events
  FOR SELECT TO authenticated
  USING (
    public.has_role_or_higher('admin'::user_role)
    OR business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS billing_events_service_insert ON public.billing_events;
CREATE POLICY billing_events_service_insert ON public.billing_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS billing_events_admin_write ON public.billing_events;
CREATE POLICY billing_events_admin_write ON public.billing_events
  FOR ALL TO authenticated
  USING (public.has_role_or_higher('admin'::user_role))
  WITH CHECK (public.has_role_or_higher('admin'::user_role));

-- ============================================================
-- 3. Seed 14-day grace trial for legacy businesses w/o subscription
--    (skip if business owner already has a user_subscriptions row,
--     because of UNIQUE(user_id) constraint)
-- ============================================================
WITH plan AS (
  SELECT id FROM public.subscription_plans WHERE name = 'Regular' LIMIT 1
),
candidates AS (
  SELECT b.id AS business_id, b.owner_id
  FROM public.businesses b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.business_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = b.owner_id
  )
),
inserted AS (
  INSERT INTO public.user_subscriptions
    (user_id, business_id, plan_id, status,
     trial_started_at, trial_ends_at,
     subscription_started_at, next_billing_date, admin_note)
  SELECT c.owner_id, c.business_id, (SELECT id FROM plan),
         'trial', now(), now() + interval '14 days',
         NULL, NULL,
         'legacy_grace_trial_step_3'
  FROM candidates c
  RETURNING business_id, user_id, trial_ends_at
)
INSERT INTO public.billing_events
  (business_id, user_id, event_type, old_status, new_status, source, metadata)
SELECT business_id, user_id, 'legacy_grace_trial_created', 'none', 'trial', 'migration_step_3',
       jsonb_build_object(
         'trial_ends_at', trial_ends_at,
         'reason', 'Legacy business without subscription seeded with 14-day grace trial before billing enforcement'
       )
FROM inserted;

-- ============================================================
-- 4. Replace business_billing_status: ignore NULL business_id,
--    priority active > trial > past_due > incomplete > restricted > cancelled > none
-- ============================================================
CREATE OR REPLACE FUNCTION public.business_billing_status(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active boolean;
  v_has_valid_trial boolean;
  v_has_past_due boolean;
  v_has_incomplete boolean;
  v_has_expired_trial boolean;
  v_has_cancelled boolean;
  v_any boolean;
BEGIN
  IF p_business_id IS NULL THEN RETURN 'none'; END IF;

  SELECT
    bool_or(status = 'active'),
    bool_or(status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at >= now()),
    bool_or(status = 'past_due'),
    bool_or(status = 'incomplete'),
    bool_or(status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at < now())),
    bool_or(status = 'cancelled'),
    COUNT(*) > 0
  INTO v_has_active, v_has_valid_trial, v_has_past_due, v_has_incomplete,
       v_has_expired_trial, v_has_cancelled, v_any
  FROM public.user_subscriptions
  WHERE business_id = p_business_id;

  IF NOT v_any THEN RETURN 'none'; END IF;
  IF v_has_active THEN RETURN 'active'; END IF;
  IF v_has_valid_trial THEN RETURN 'trial'; END IF;
  IF v_has_past_due THEN RETURN 'past_due'; END IF;
  IF v_has_incomplete THEN RETURN 'incomplete'; END IF;
  IF v_has_expired_trial THEN RETURN 'restricted'; END IF;
  IF v_has_cancelled THEN RETURN 'cancelled'; END IF;
  RETURN 'none';
END;
$$;

-- ============================================================
-- 5. can_business_write helper (future RLS gate)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_business_write(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.business_billing_status(p_business_id) IN ('active','trial');
$$;

-- ============================================================
-- 6. require_active_business helper (future Edge Function gate)
-- ============================================================
CREATE OR REPLACE FUNCTION public.require_active_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := public.business_billing_status(p_business_id);
  IF v_status IN ('active','trial') THEN
    RETURN true;
  END IF;
  RAISE EXCEPTION 'Business billing inactive (status=%). Active subscription or valid trial required.', v_status
    USING ERRCODE = 'P0001';
END;
$$;
