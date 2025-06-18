
-- Create admin search function that can access auth.users
CREATE OR REPLACE FUNCTION public.get_users_for_admin_search(search_pattern text)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  role user_role,
  created_at timestamptz
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
    u.id,
    u.email,
    COALESCE(p.first_name, '') as first_name,
    COALESCE(p.last_name, '') as last_name,
    COALESCE(ur.role, 'free_user'::user_role) as role,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE 
    u.email ILIKE search_pattern OR
    p.first_name ILIKE search_pattern OR
    p.last_name ILIKE search_pattern
  ORDER BY u.created_at DESC
  LIMIT 20;
END;
$$;
