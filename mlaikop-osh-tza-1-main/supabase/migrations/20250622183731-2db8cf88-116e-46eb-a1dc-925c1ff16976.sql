
-- Create unique index for case-insensitive business names (instead of constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_name_unique_lower 
ON public.businesses (LOWER(name));

-- Ensure business_users table exists with proper structure
CREATE TABLE IF NOT EXISTS public.business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, business_id)
);

-- Enable RLS on business_users
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for business_users
DROP POLICY IF EXISTS "business_users_select_policy" ON public.business_users;
CREATE POLICY "business_users_select_policy" 
ON public.business_users 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "business_users_insert_policy" ON public.business_users;
CREATE POLICY "business_users_insert_policy" 
ON public.business_users 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "business_users_update_policy" ON public.business_users;
CREATE POLICY "business_users_update_policy" 
ON public.business_users 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = business_id AND b.owner_id = auth.uid()
  )
);

-- Function to check if user has completed onboarding
CREATE OR REPLACE FUNCTION public.user_has_business_access(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE owner_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM public.business_users 
    WHERE user_id = user_uuid AND status = 'approved'
  );
$$;

-- Function to get user's business context
CREATE OR REPLACE FUNCTION public.get_user_business_context(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  business_id UUID,
  business_name TEXT,
  user_role TEXT,
  is_owner BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  -- First check if user owns a business
  SELECT b.id, b.name, 'OWNER'::TEXT, true
  FROM public.businesses b
  WHERE b.owner_id = user_uuid
  
  UNION ALL
  
  -- Then check if user is approved member of a business
  SELECT b.id, b.name, bu.role, false
  FROM public.businesses b
  JOIN public.business_users bu ON b.id = bu.business_id
  WHERE bu.user_id = user_uuid AND bu.status = 'approved'
  
  LIMIT 1;
$$;
