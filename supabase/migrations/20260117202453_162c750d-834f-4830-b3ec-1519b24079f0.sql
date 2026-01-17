-- Drop functions with changed return types first
DROP FUNCTION IF EXISTS public.get_user_profile_for_admin(uuid);
DROP FUNCTION IF EXISTS public.search_products(text, uuid, integer);
DROP FUNCTION IF EXISTS public.get_expiring_products(integer, uuid);