
-- Create a function for admin user search
CREATE OR REPLACE FUNCTION public.search_users_for_admin(search_pattern text)
 RETURNS TABLE(
   user_id uuid,
   email text,
   first_name text,
   last_name text,
   is_active boolean,
   created_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.emails e ON p.id = e.user_id
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE 
    (search_pattern = '' OR 
     p.first_name ILIKE '%' || search_pattern || '%' OR
     p.last_name ILIKE '%' || search_pattern || '%' OR
     e.email ILIKE '%' || search_pattern || '%' OR
     au.email ILIKE '%' || search_pattern || '%')
  ORDER BY p.created_at DESC
  LIMIT 50;
END;
$function$;

-- Create a function to toggle user active status
CREATE OR REPLACE FUNCTION public.toggle_user_active_status(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_status boolean;
BEGIN
  -- Only allow admin users to run this function
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Toggle the is_active status
  UPDATE public.profiles 
  SET is_active = NOT is_active, updated_at = now()
  WHERE id = target_user_id
  RETURNING is_active INTO new_status;

  RETURN new_status;
END;
$function$;

-- Create a function to delete user (with all related data)
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Only allow admin users to run this function
  IF NOT public.has_role_or_higher('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Delete from profiles (this will cascade to other tables due to foreign keys)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Delete from emails table
  DELETE FROM public.emails WHERE user_id = target_user_id;
  
  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  RETURN true;
END;
$function$;
