
-- Create admin function to get detailed user profile information
CREATE OR REPLACE FUNCTION public.get_user_profile_for_admin(target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  is_active boolean,
  created_at timestamptz,
  role user_role,
  business_name text,
  subscription_status text,
  subscription_plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only allow admin users to run this function
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(e.email, au.email) as email,
    COALESCE(p.first_name, '') as first_name,
    COALESCE(p.last_name, '') as last_name,
    p.is_active,
    p.created_at,
    COALESCE(ur.role, 'free_user'::user_role) as role,
    b.name as business_name,
    us.status as subscription_status,
    sp.name as subscription_plan
  FROM public.profiles p
  LEFT JOIN public.emails e ON p.id = e.user_id
  LEFT JOIN auth.users au ON p.id = au.id
  LEFT JOIN public.user_roles ur ON p.id = ur.user_id
  LEFT JOIN public.businesses b ON p.business_id = b.id
  LEFT JOIN public.user_subscriptions us ON p.id = us.user_id AND us.status = 'active'
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE p.id = target_user_id
  LIMIT 1;
END;
$$;
