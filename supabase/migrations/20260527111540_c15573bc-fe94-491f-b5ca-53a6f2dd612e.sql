
CREATE OR REPLACE FUNCTION public.activate_subscription_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_already_activated boolean;
  v_plan_exists boolean;
BEGIN
  -- Only act on actual transition into 'paid'
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: if we already activated for this session, do nothing
  SELECT EXISTS (
    SELECT 1 FROM public.billing_events
    WHERE event_type = 'subscription_activated'
      AND (metadata->>'payment_session_id') = NEW.id::text
  ) INTO v_already_activated;

  IF v_already_activated THEN
    RETURN NEW;
  END IF;

  -- Resolve owner from businesses (canonical source)
  SELECT owner_id INTO v_owner_id
  FROM public.businesses
  WHERE id = NEW.business_id;

  -- Validate plan
  SELECT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = NEW.plan_id)
  INTO v_plan_exists;

  IF v_owner_id IS NULL OR NEW.business_id IS NULL OR NEW.plan_id IS NULL OR NOT v_plan_exists THEN
    BEGIN
      INSERT INTO public.billing_events (
        business_id, user_id, event_type, source, new_status, metadata
      ) VALUES (
        NEW.business_id, COALESCE(v_owner_id, NEW.user_id),
        'billing_activation_failed',
        'payment_sessions_paid_trigger',
        'paid',
        jsonb_build_object(
          'payment_session_id', NEW.id,
          'plan_id', NEW.plan_id,
          'business_id', NEW.business_id,
          'reason',
            CASE
              WHEN v_owner_id IS NULL THEN 'owner_not_found'
              WHEN NEW.business_id IS NULL THEN 'missing_business_id'
              WHEN NEW.plan_id IS NULL THEN 'missing_plan_id'
              WHEN NOT v_plan_exists THEN 'plan_not_found'
            END
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- never break the webhook
      NULL;
    END;
    RETURN NEW;
  END IF;

  -- Upsert subscription for the owner (UNIQUE on user_id)
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id, business_id, plan_id, status,
      started_at, subscription_started_at, current_period_end,
      provider_payment_id, updated_at
    ) VALUES (
      v_owner_id, NEW.business_id, NEW.plan_id, 'active',
      now(), now(), now() + interval '1 month',
      NEW.id::text, now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET status                  = 'active',
          plan_id                 = EXCLUDED.plan_id,
          business_id             = EXCLUDED.business_id,
          started_at              = COALESCE(public.user_subscriptions.started_at, EXCLUDED.started_at),
          subscription_started_at = COALESCE(public.user_subscriptions.subscription_started_at, EXCLUDED.subscription_started_at),
          current_period_end      = EXCLUDED.current_period_end,
          canceled_at             = NULL,
          cancellation_reason     = NULL,
          provider_payment_id     = EXCLUDED.provider_payment_id,
          updated_at              = now();
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.billing_events (
      business_id, user_id, event_type, source, old_status, new_status, metadata
    ) VALUES (
      NEW.business_id, v_owner_id,
      'billing_activation_failed',
      'payment_sessions_paid_trigger',
      OLD.status, 'paid',
      jsonb_build_object(
        'payment_session_id', NEW.id,
        'plan_id', NEW.plan_id,
        'error', SQLERRM
      )
    );
    RETURN NEW;
  END;

  -- Success event
  INSERT INTO public.billing_events (
    business_id, user_id, event_type, source, old_status, new_status, metadata
  ) VALUES (
    NEW.business_id, v_owner_id,
    'subscription_activated',
    'payment_sessions_paid_trigger',
    OLD.status, 'paid',
    jsonb_build_object(
      'payment_session_id', NEW.id,
      'plan_id', NEW.plan_id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'owner_id', v_owner_id,
      'period_end', (now() + interval '1 month')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_subscription_on_paid ON public.payment_sessions;

CREATE TRIGGER trg_activate_subscription_on_paid
AFTER UPDATE OF status ON public.payment_sessions
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')
EXECUTE FUNCTION public.activate_subscription_on_paid();
