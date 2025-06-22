
-- Remove ALL existing policies on businesses table to clean up the mess
DROP POLICY IF EXISTS "businesses_select_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON public.businesses;
DROP POLICY IF EXISTS "Users can view their own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can create their own business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can update their own business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can delete their own business" ON public.businesses;
DROP POLICY IF EXISTS "Only business owners with OWNER role can update" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can create business" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can delete business" ON public.businesses;

-- Create clean, simple policies that only check owner_id = auth.uid()
CREATE POLICY "businesses_owner_select" 
ON public.businesses FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "businesses_owner_insert" 
ON public.businesses FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "businesses_owner_update" 
ON public.businesses FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "businesses_owner_delete" 
ON public.businesses FOR DELETE 
USING (owner_id = auth.uid());
