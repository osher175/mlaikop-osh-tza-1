
-- ============================================
-- PART 1.1: Fix user_roles.business_id default
-- ============================================
ALTER TABLE public.user_roles ALTER COLUMN business_id SET DEFAULT NULL;

-- ============================================
-- PART 1.2: Atomic Business Creation RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.create_business_for_new_user(
  p_business_name text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_business_id uuid;
BEGIN
  -- Idempotency: if user already owns a business, return it
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE owner_id = v_user_id
  LIMIT 1;

  IF v_business_id IS NOT NULL THEN
    RETURN v_business_id;
  END IF;

  -- Create business
  INSERT INTO public.businesses (name, phone, owner_id)
  VALUES (p_business_name, p_phone, v_user_id)
  RETURNING id INTO v_business_id;

  -- Add to user_businesses join table
  INSERT INTO public.user_businesses (user_id, business_id, role)
  VALUES (v_user_id, v_business_id, 'OWNER')
  ON CONFLICT DO NOTHING;

  -- Update user_roles with the new business_id
  UPDATE public.user_roles
  SET business_id = v_business_id
  WHERE user_id = v_user_id;

  -- Update profiles with business_id
  UPDATE public.profiles
  SET business_id = v_business_id
  WHERE id = v_user_id;

  RETURN v_business_id;
END;
$$;

-- ============================================
-- PART 2.1: Premium Server-Side Gate
-- ============================================
CREATE OR REPLACE FUNCTION public.require_premium(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_status text;
  v_trial_ends_at timestamptz;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM public.businesses
  WHERE id = p_business_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT status, trial_ends_at INTO v_status, v_trial_ends_at
  FROM public.user_subscriptions
  WHERE user_id = v_owner_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_status = 'active' THEN
    RETURN true;
  END IF;

  IF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at > now() THEN
    RETURN true;
  END IF;

  RAISE EXCEPTION 'Premium subscription required';
END;
$$;

-- ============================================
-- PART 3: business_channels table
-- ============================================
CREATE TABLE public.business_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'error')),
  webhook_verify_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_health_check_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_business_channels_phone_number_id
  ON public.business_channels(phone_number_id);

CREATE INDEX idx_business_channels_business
  ON public.business_channels(business_id);

-- Enable RLS
ALTER TABLE public.business_channels ENABLE ROW LEVEL SECURITY;

-- SELECT: business owner or approved member
CREATE POLICY "bc_select" ON public.business_channels
FOR SELECT TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
  OR business_id IN (
    SELECT bu.business_id FROM public.business_users bu
    WHERE bu.user_id = auth.uid() AND bu.status = 'approved'
  )
);

-- INSERT: business owner only
CREATE POLICY "bc_insert" ON public.business_channels
FOR INSERT TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- UPDATE: business owner only
CREATE POLICY "bc_update" ON public.business_channels
FOR UPDATE TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_business_channels_updated_at
BEFORE UPDATE ON public.business_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Fix existing user_roles rows where business_id = user_id (the bug)
-- ============================================
UPDATE public.user_roles
SET business_id = NULL
WHERE business_id IS NOT NULL
  AND business_id NOT IN (SELECT id FROM public.businesses);
