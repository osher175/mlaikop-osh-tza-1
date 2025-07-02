
-- Create emails table for logging user email addresses
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for better performance on email lookups
CREATE INDEX idx_emails_email ON public.emails(email);
CREATE INDEX idx_emails_user_id ON public.emails(user_id);

-- Enable Row Level Security
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Create policy that only allows admins to read the emails table
CREATE POLICY "Only admins can view emails" 
  ON public.emails 
  FOR SELECT 
  USING (public.has_role_or_higher('admin'::user_role));

-- Create policy that only allows admins to insert emails manually
CREATE POLICY "Only admins can insert emails manually" 
  ON public.emails 
  FOR INSERT 
  WITH CHECK (public.has_role_or_higher('admin'::user_role));

-- Create function to log user email on signup
CREATE OR REPLACE FUNCTION public.log_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert email into emails table when user signs up
  INSERT INTO public.emails (email, user_id)
  VALUES (NEW.email, NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically log email when user is created
CREATE TRIGGER on_auth_user_email_log
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_user_email();
