
-- Drop the existing trigger first
DROP TRIGGER IF EXISTS log_product_activity_trigger ON public.products;

-- Recreate the trigger to run BEFORE DELETE instead of AFTER
CREATE TRIGGER log_product_activity_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_activity();
