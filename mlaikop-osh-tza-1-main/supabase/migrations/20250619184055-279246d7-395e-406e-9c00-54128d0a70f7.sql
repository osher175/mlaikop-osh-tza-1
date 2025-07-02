
-- Add missing columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS phone text;

-- Add a role column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Enable RLS on businesses table if not already enabled
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for businesses - users can only view businesses they own
CREATE POLICY "Users can view their own business" 
ON public.businesses FOR SELECT 
USING (owner_id = auth.uid());

-- Create RLS policy for businesses - only owners can update their business
CREATE POLICY "Owners can update their own business" 
ON public.businesses FOR UPDATE 
USING (owner_id = auth.uid());

-- Create RLS policy for businesses - users can insert their own business
CREATE POLICY "Users can create their own business" 
ON public.businesses FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- Create RLS policy for businesses - owners can delete their business
CREATE POLICY "Owners can delete their own business" 
ON public.businesses FOR DELETE 
USING (owner_id = auth.uid());
