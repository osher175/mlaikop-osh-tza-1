
-- Create business_users table for managing user-business relationships
CREATE TABLE public.business_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'EMPLOYEE')),
  status text NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, business_id)
);

-- Enable RLS on business_users table
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own business relationships
CREATE POLICY "Users can view their own business relationships" ON public.business_users
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for business owners to see all members of their business
CREATE POLICY "Business owners can view all members" ON public.business_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.businesses b 
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

-- Policy for users to insert their own business relationships
CREATE POLICY "Users can create their own business relationships" ON public.business_users
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for business owners to update member status
CREATE POLICY "Business owners can update member status" ON public.business_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.businesses b 
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );

-- Add RLS policies for businesses table if not exists
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Policy for business owners to view their own business
CREATE POLICY "Business owners can view their own business" ON public.businesses
  FOR SELECT USING (auth.uid() = owner_id);

-- Policy for business members to view their business
CREATE POLICY "Business members can view their business" ON public.businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.business_users bu 
      WHERE bu.business_id = id AND bu.user_id = auth.uid() AND bu.status = 'approved'
    )
  );

-- Policy for authenticated users to create businesses
CREATE POLICY "Authenticated users can create businesses" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Policy for business owners to update their own business
CREATE POLICY "Business owners can update their own business" ON public.businesses
  FOR UPDATE USING (auth.uid() = owner_id);
