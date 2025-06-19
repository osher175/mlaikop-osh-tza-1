
-- Add password column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN password text;

-- Add comment to document the field purpose
COMMENT ON COLUMN public.profiles.password IS 'User password stored during initial signup - for internal use only';

-- Update the handle_new_user function to store password during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, password)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'password'
  );
  RETURN NEW;
END;
$$;
