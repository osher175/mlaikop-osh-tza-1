
-- Step 0: Additive schema changes for minimal signup + progressive onboarding

-- profiles: add identity fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill username for existing users
UPDATE public.profiles
SET username = 'mlaiko-' || substr(replace(id::text, '-', ''), 1, 8)
WHERE username IS NULL;

-- Backfill display_name
UPDATE public.profiles
SET display_name = COALESCE(
  NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''),
  username
)
WHERE display_name IS NULL;

-- Unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (LOWER(username));

-- businesses: add onboarding + extra fields
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS business_email TEXT;

-- Existing businesses are already operational → mark as completed
UPDATE public.businesses
SET onboarding_completed = true
WHERE onboarding_completed = false;

-- Update handle_new_user trigger to also generate username/display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_username TEXT;
  v_display TEXT;
BEGIN
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    'mlaiko-' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  v_display := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(TRIM(
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', '') || ' ' ||
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
    ), ''),
    v_username
  );

  INSERT INTO public.profiles (id, first_name, last_name, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    v_username,
    v_display
  );

  IF NEW.email = 'oshritzafriri@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'free_user');
  RETURN NEW;
END;
$function$;

-- New RPC: mark onboarding complete + ensure default notification settings
CREATE OR REPLACE FUNCTION public.complete_business_onboarding(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_member boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_businesses
    WHERE user_id = v_user_id AND business_id = p_business_id
  ) OR EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = p_business_id AND owner_id = v_user_id
  )
  INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied to business';
  END IF;

  UPDATE public.businesses
  SET onboarding_completed = true, updated_at = now()
  WHERE id = p_business_id;

  INSERT INTO public.notification_settings (
    business_id, low_stock_enabled, low_stock_threshold,
    expiration_enabled, expiration_days_warning, plan_limit_enabled
  )
  VALUES (p_business_id, true, 5, true, 7, true)
  ON CONFLICT (business_id) DO NOTHING;

  RETURN true;
END;
$function$;
