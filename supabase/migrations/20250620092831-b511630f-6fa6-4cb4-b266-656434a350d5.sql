
-- Add plan tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_plan_id TEXT REFERENCES public.subscription_plans_new(plan);

-- Add unique constraint to business names if not exists
ALTER TABLE public.businesses 
DROP CONSTRAINT IF EXISTS businesses_name_unique;
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_name_unique UNIQUE (name);

-- Update handle_new_user function to not assign OWNER role immediately
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- הוספת פרופיל למשתמש חדש
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- בדיקה אם המשתמש הוא admin מרכזי
  IF NEW.email = 'oshritzafriri@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;
  
  -- כל המשתמשים החדשים מתחילים כ-free_user
  -- הם יקבלו OWNER רק לאחר בחירת תוכנית ויצירת עסק
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'free_user');
  
  RETURN NEW;
END;
$$;

-- Function to validate business name uniqueness
CREATE OR REPLACE FUNCTION public.is_business_name_available(business_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.businesses 
    WHERE LOWER(name) = LOWER(business_name)
  );
$$;
