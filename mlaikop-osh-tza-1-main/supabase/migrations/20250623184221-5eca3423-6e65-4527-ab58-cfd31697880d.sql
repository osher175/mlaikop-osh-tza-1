
-- Fix the products_created_by foreign key constraint to allow CASCADE DELETE
-- This will allow users to be deleted even if they created products

-- Remove the existing foreign key constraint
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_created_by_fkey;

-- Add the new foreign key constraint with CASCADE DELETE
ALTER TABLE public.products
ADD CONSTRAINT products_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Verify the constraint was created successfully
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    confdeltype as delete_action
FROM pg_constraint 
WHERE conname = 'products_created_by_fkey';
