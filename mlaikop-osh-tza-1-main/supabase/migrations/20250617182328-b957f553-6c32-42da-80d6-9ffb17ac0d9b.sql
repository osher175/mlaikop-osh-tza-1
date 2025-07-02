
-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM (
  'admin',
  'free_user',
  'pro_starter_user',
  'smart_master_user',
  'elite_pilot_user'
);

-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  role user_role NOT NULL UNIQUE,
  monthly_price DECIMAL(10,2),
  setup_fee DECIMAL(10,2),
  storage_gb INTEGER,
  ai_access BOOLEAN DEFAULT FALSE,
  max_users INTEGER,
  duration_months INTEGER,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'free_user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, role, monthly_price, setup_fee, storage_gb, ai_access, max_users, duration_months, features) VALUES
('Freemium', 'free_user', 0, 0, 1, false, 1, 1, '{"basic_inventory": true, "limited_products": 50}'),
('Premium 1', 'pro_starter_user', 399.90, 1499, 10, false, 999, 12, '{"unlimited_inventory": true, "basic_reports": true}'),
('Premium 2', 'smart_master_user', 799.90, 1499, 25, true, 999, 12, '{"unlimited_inventory": true, "advanced_reports": true, "partial_ai": true}'),
('Premium 3', 'elite_pilot_user', 1199.90, 2999, 50, true, 999, 24, '{"unlimited_inventory": true, "full_reports": true, "full_ai": true, "priority_support": true}');

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = user_uuid),
    'free_user'::user_role
  );
$$;

-- Create function to check if user has specific role or higher
CREATE OR REPLACE FUNCTION public.has_role_or_higher(required_role user_role, user_uuid UUID DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE public.get_user_role(user_uuid)
    WHEN 'admin' THEN true
    WHEN 'elite_pilot_user' THEN required_role IN ('elite_pilot_user', 'smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'smart_master_user' THEN required_role IN ('smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'pro_starter_user' THEN required_role IN ('pro_starter_user', 'free_user')
    WHEN 'free_user' THEN required_role = 'free_user'
    ELSE false
  END;
$$;

-- RLS Policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Update the handle_new_user function to assign default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Assign default free_user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user');
  
  RETURN NEW;
END;
$$;
