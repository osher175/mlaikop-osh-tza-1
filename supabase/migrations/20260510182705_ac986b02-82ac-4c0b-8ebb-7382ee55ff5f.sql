CREATE OR REPLACE FUNCTION public.ensure_trial_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_default_plan uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Idempotent: do nothing if user already has any subscription row
  IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = v_user) THEN
    RETURN;
  END IF;

  -- Resolve default plan server-side: cheapest plan, oldest first as tie-breaker
  SELECT id INTO v_default_plan
  FROM public.subscription_plans
  ORDER BY monthly_price ASC NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_default_plan IS NULL THEN
    RAISE EXCEPTION 'no_subscription_plan_found';
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, trial_ends_at, expires_at)
  VALUES (
    v_user,
    v_default_plan,
    'trial',
    now() + interval '30 days',
    NULL
  );
END;
$$;

-- Re-assert least-privilege execution: no PUBLIC, no anon
REVOKE ALL ON FUNCTION public.ensure_trial_subscription() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_trial_subscription() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription() TO service_role;