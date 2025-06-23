
-- Remove the foreign key constraint from recent_activity.product_id to allow NULL values after product deletion
ALTER TABLE public.recent_activity 
DROP CONSTRAINT IF EXISTS recent_activity_product_id_fkey;

-- Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.recent_activity 
ADD CONSTRAINT recent_activity_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
