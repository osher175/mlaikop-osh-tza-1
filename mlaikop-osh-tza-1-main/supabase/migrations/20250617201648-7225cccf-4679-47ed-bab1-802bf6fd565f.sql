
-- Create user_subscriptions table to track individual user subscription status
CREATE TABLE public.user_subscriptions_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL REFERENCES public.subscription_plans_new(plan),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure one active subscription per user
  UNIQUE(user_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create index for faster lookups
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions_new(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions_new(status);
CREATE INDEX idx_user_subscriptions_expires_at ON public.user_subscriptions_new(expires_at);

-- Enable RLS
ALTER TABLE public.user_subscriptions_new ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_subscriptions_new
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only admins can modify user subscriptions
CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_subscriptions_new
  FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Users can insert their own subscription (for self-service upgrades)
CREATE POLICY "Users can create their own subscriptions"
  ON public.user_subscriptions_new
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to handle subscription updates and maintain data integrity
CREATE OR REPLACE FUNCTION public.handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = now();
  
  -- If setting a subscription to active, mark others as expired
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    UPDATE public.user_subscriptions_new 
    SET status = 'expired', updated_at = now()
    WHERE user_id = NEW.user_id 
    AND id != NEW.id 
    AND status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for subscription changes
CREATE TRIGGER subscription_change_trigger
  BEFORE INSERT OR UPDATE ON public.user_subscriptions_new
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_change();
