
-- Remove the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Only business owners with OWNER role can update" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can create business" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can delete business" ON public.businesses;

-- Create simple, non-recursive policies for businesses table
CREATE POLICY "Users can view their own business" 
ON public.businesses FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own business" 
ON public.businesses FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their own business" 
ON public.businesses FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their own business" 
ON public.businesses FOR DELETE 
USING (owner_id = auth.uid());
