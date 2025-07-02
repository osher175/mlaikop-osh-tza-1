
-- Add is_active field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Update existing records to be active by default
UPDATE public.profiles 
SET is_active = true 
WHERE is_active IS NULL;

-- Add comment to document the field purpose
COMMENT ON COLUMN public.profiles.is_active IS 'Indicates whether the user profile is active or disabled';
