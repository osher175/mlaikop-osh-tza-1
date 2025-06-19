
-- Remove existing business update policy
DROP POLICY IF EXISTS "Owners can update their own business" ON public.businesses;

-- Create enhanced policy that checks both ownership and OWNER role
CREATE POLICY "Only business owners with OWNER role can update" 
ON public.businesses FOR UPDATE 
USING (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Also update the insert policy to ensure only OWNER role can create businesses
DROP POLICY IF EXISTS "Users can create their own business" ON public.businesses;

CREATE POLICY "Only OWNER role can create business" 
ON public.businesses FOR INSERT 
WITH CHECK (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- Update delete policy for consistency
DROP POLICY IF EXISTS "Owners can delete their own business" ON public.businesses;

CREATE POLICY "Only OWNER role can delete business" 
ON public.businesses FOR DELETE 
USING (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'OWNER'
  )
);
