
-- Create enum for support levels
CREATE TYPE public.support_level AS ENUM ('basic', 'standard', 'advanced', 'vip');

-- Create subscription_plans table
CREATE TABLE public.subscription_plans_new (
  plan TEXT PRIMARY KEY,
  storage_limit INTEGER NOT NULL,
  ai_credit INTEGER NOT NULL,
  user_limit INTEGER NOT NULL,
  support_level support_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert the predefined subscription plans
INSERT INTO public.subscription_plans_new (plan, storage_limit, ai_credit, user_limit, support_level) VALUES
  ('free', 1, 0, 1, 'basic'),
  ('starter', 5, 0, 2, 'basic'),
  ('premium1', 10, 0, 5, 'standard'),
  ('premium2', 25, 150, 10, 'advanced'),
  ('premium3', 50, -1, -1, 'vip');

-- Enable RLS on the table
ALTER TABLE public.subscription_plans_new ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription_plans_new
-- Allow all authenticated users to read subscription plans
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans_new
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify subscription plans
CREATE POLICY "Admins can modify subscription plans"
  ON public.subscription_plans_new
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
