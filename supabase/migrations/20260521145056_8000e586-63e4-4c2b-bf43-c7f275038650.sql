
-- Results capture
DROP TABLE IF EXISTS public._qa_billing_results;
CREATE TABLE public._qa_billing_results (
  scenario text,
  sub_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  computed_status text,
  can_write boolean,
  require_active_raised boolean,
  require_active_error text,
  checked_at timestamptz default now()
);

DO $$
DECLARE
  v_business uuid := 'b50d6eae-cfaa-478f-9aad-e5890438deff';
  v_user uuid := '2ce0b0d9-3d3d-4174-9919-4d845749387f';
  v_sub uuid := '8028b6eb-b085-4dc2-a23e-893ded898509';
  v_status text;
  v_can boolean;
  v_raised boolean;
  v_msg text;
BEGIN
  -- Attach the existing subscription to the QA business for the duration of the test
  UPDATE public.user_subscriptions
  SET business_id = v_business
  WHERE id = v_sub;

  -- Helper inline: for each scenario, set the sub, then capture status
  -- Scenario 1: active
  UPDATE public.user_subscriptions
  SET status='active', trial_ends_at=NULL,
      current_period_end = now() + interval '30 days'
  WHERE id = v_sub;

  v_status := public.business_billing_status(v_business);
  v_can := public.can_business_write(v_business);
  BEGIN
    PERFORM public.require_active_business(v_business);
    v_raised := false; v_msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; v_msg := SQLERRM;
  END;
  INSERT INTO public._qa_billing_results
    (scenario, sub_status, trial_ends_at, current_period_end,
     computed_status, can_write, require_active_raised, require_active_error)
  SELECT 'S1_active', status, trial_ends_at, current_period_end,
         v_status, v_can, v_raised, v_msg
  FROM public.user_subscriptions WHERE id = v_sub;

  -- Scenario 2: trial (valid, 7 days ahead)
  UPDATE public.user_subscriptions
  SET status='trial',
      trial_ends_at = now() + interval '7 days',
      current_period_end = NULL
  WHERE id = v_sub;

  v_status := public.business_billing_status(v_business);
  v_can := public.can_business_write(v_business);
  BEGIN
    PERFORM public.require_active_business(v_business);
    v_raised := false; v_msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; v_msg := SQLERRM;
  END;
  INSERT INTO public._qa_billing_results
    (scenario, sub_status, trial_ends_at, current_period_end,
     computed_status, can_write, require_active_raised, require_active_error)
  SELECT 'S2_trial_valid', status, trial_ends_at, current_period_end,
         v_status, v_can, v_raised, v_msg
  FROM public.user_subscriptions WHERE id = v_sub;

  -- Scenario 3: cancelled
  UPDATE public.user_subscriptions
  SET status='cancelled',
      trial_ends_at = NULL,
      current_period_end = NULL,
      canceled_at = now()
  WHERE id = v_sub;

  v_status := public.business_billing_status(v_business);
  v_can := public.can_business_write(v_business);
  BEGIN
    PERFORM public.require_active_business(v_business);
    v_raised := false; v_msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; v_msg := SQLERRM;
  END;
  INSERT INTO public._qa_billing_results
    (scenario, sub_status, trial_ends_at, current_period_end,
     computed_status, can_write, require_active_raised, require_active_error)
  SELECT 'S3_cancelled', status, trial_ends_at, current_period_end,
         v_status, v_can, v_raised, v_msg
  FROM public.user_subscriptions WHERE id = v_sub;

  -- Scenario 4: expired trial -> should map to 'restricted'
  UPDATE public.user_subscriptions
  SET status='trial',
      trial_ends_at = now() - interval '1 day',
      current_period_end = NULL,
      canceled_at = NULL
  WHERE id = v_sub;

  v_status := public.business_billing_status(v_business);
  v_can := public.can_business_write(v_business);
  BEGIN
    PERFORM public.require_active_business(v_business);
    v_raised := false; v_msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; v_msg := SQLERRM;
  END;
  INSERT INTO public._qa_billing_results
    (scenario, sub_status, trial_ends_at, current_period_end,
     computed_status, can_write, require_active_raised, require_active_error)
  SELECT 'S4_trial_expired_restricted', status, trial_ends_at, current_period_end,
         v_status, v_can, v_raised, v_msg
  FROM public.user_subscriptions WHERE id = v_sub;

  -- Scenario 5: restore to active and re-verify
  UPDATE public.user_subscriptions
  SET status='active',
      trial_ends_at = NULL,
      current_period_end = now() + interval '30 days',
      canceled_at = NULL
  WHERE id = v_sub;

  v_status := public.business_billing_status(v_business);
  v_can := public.can_business_write(v_business);
  BEGIN
    PERFORM public.require_active_business(v_business);
    v_raised := false; v_msg := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; v_msg := SQLERRM;
  END;
  INSERT INTO public._qa_billing_results
    (scenario, sub_status, trial_ends_at, current_period_end,
     computed_status, can_write, require_active_raised, require_active_error)
  SELECT 'S5_restored_active', status, trial_ends_at, current_period_end,
         v_status, v_can, v_raised, v_msg
  FROM public.user_subscriptions WHERE id = v_sub;

  -- Final: detach subscription from QA business and restore original orphan-trial values
  UPDATE public.user_subscriptions
  SET business_id = NULL,
      status='trial',
      trial_ends_at = '2026-06-09 18:27:49.947062+00'::timestamptz,
      current_period_end = NULL,
      canceled_at = NULL
  WHERE id = v_sub;
END $$;
