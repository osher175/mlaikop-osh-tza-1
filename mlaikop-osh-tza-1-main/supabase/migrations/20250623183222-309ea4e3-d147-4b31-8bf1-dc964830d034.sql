
-- Remove the existing foreign key constraint
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_business_id_fkey;

-- Add the new foreign key constraint with CASCADE DELETE
ALTER TABLE public.products
ADD CONSTRAINT products_business_id_fkey
FOREIGN KEY (business_id)
REFERENCES public.businesses(id)
ON DELETE CASCADE;

-- Verify the constraint was created successfully
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    confdeltype as delete_action
FROM pg_constraint 
WHERE conname = 'products_business_id_fkey';
