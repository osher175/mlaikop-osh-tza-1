
-- Update the delete_user_by_admin function to properly delete from auth.users
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

  -- Log the deletion attempt
  RAISE LOG 'Admin user deletion started for user ID: %', target_user_id;

  -- Delete from auth.users first (this will cascade to auth-related tables)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Check if the user was deleted from auth.users
  IF NOT FOUND THEN
    RAISE LOG 'User ID % not found in auth.users', target_user_id;
    RETURN false;
  END IF;
  
  -- Delete from public schema tables (these should cascade due to foreign keys)
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM public.emails WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  RAISE LOG 'Admin user deletion completed successfully for user ID: %', target_user_id;
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in delete_user_by_admin for user ID %: % - %', target_user_id, SQLERRM, SQLSTATE;
    RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$function$;
