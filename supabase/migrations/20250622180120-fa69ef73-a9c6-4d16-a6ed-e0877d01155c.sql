
-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view businesses they belong to" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can view their own business" ON public.businesses;
DROP POLICY IF EXISTS "Business members can view their business" ON public.businesses;
DROP POLICY IF EXISTS "Select businesses for owner or approved users" ON public.businesses;
DROP POLICY IF EXISTS "Only business owners with OWNER role can update" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can create business" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can delete business" ON public.businesses;
DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can update their own business" ON public.businesses;
DROP POLICY IF EXISTS "Insert business for authenticated users" ON public.businesses;

-- 1. SELECT Policy: Allow viewing if owner OR approved business member
CREATE POLICY "businesses_select_policy" 
ON public.businesses 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = owner_id 
  OR EXISTS (
    SELECT 1 FROM public.business_users
    WHERE business_users.business_id = businesses.id
    AND business_users.user_id = auth.uid()
    AND business_users.status = 'approved'
  )
);

-- 2. INSERT Policy: Allow any authenticated user to create a business
CREATE POLICY "businesses_insert_policy" 
ON public.businesses 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. UPDATE Policy: Allow only the business owner to update
CREATE POLICY "businesses_update_policy" 
ON public.businesses 
FOR UPDATE 
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 4. DELETE Policy: Allow only the business owner to delete
CREATE POLICY "businesses_delete_policy" 
ON public.businesses 
FOR DELETE 
TO authenticated
USING (auth.uid() = owner_id);
