
-- QA Billing Test seed: create QA business owned by existing test user m1test
-- and a dedicated business-scoped subscription. Live businesses untouched.

DO $$
DECLARE
  v_owner uuid := '2ce0b0d9-3d3d-4174-9919-4d845749387f'; -- m1test+284843906@mlaiko-test.com
  v_business uuid;
  v_plan uuid := '2deb68cc-ab61-4e31-9447-a1a82d277fe1'; -- Regular
BEGIN
  -- Avoid duplicate if rerun
  SELECT id INTO v_business FROM public.businesses WHERE name = 'QA Billing Test Business';

  IF v_business IS NULL THEN
    INSERT INTO public.businesses (name, owner_id)
    VALUES ('QA Billing Test Business', v_owner)
    RETURNING id INTO v_business;
  END IF;

  -- user_businesses (user_id is PK -> one per user). m1test has no row, safe.
  INSERT INTO public.user_businesses (user_id, business_id, role)
  VALUES (v_owner, v_business, 'OWNER')
  ON CONFLICT (user_id) DO NOTHING;

  -- business_users approved OWNER membership
  INSERT INTO public.business_users (user_id, business_id, role, status)
  VALUES (v_owner, v_business, 'OWNER', 'approved')
  ON CONFLICT (user_id, business_id) DO UPDATE SET status='approved', role='OWNER';

  -- Seed business-scoped active subscription (separate row, leaves the orphan trial alone)
  INSERT INTO public.user_subscriptions
    (user_id, plan_id, status, business_id, started_at,
     subscription_started_at, current_period_end, admin_note)
  VALUES
    (v_owner, v_plan, 'active', v_business, now(),
     now(), now() + interval '30 days', 'QA Billing Test seed - safe to delete')
  ON CONFLICT DO NOTHING;
END $$;
