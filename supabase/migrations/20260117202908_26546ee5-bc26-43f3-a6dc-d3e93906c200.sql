-- Drop remaining functions with changed return types
DROP FUNCTION IF EXISTS public.get_product_autocomplete(text, uuid, integer);