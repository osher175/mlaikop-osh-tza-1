
-- פונקציה לבדיקה אם משתמש הוא הראשון בעסק
CREATE OR REPLACE FUNCTION public.is_first_user_in_business(business_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.business_id = business_uuid
  );
$$;

-- עדכון פונקציית handle_new_user לטיפול ב-OWNER אוטומטי
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_business_id uuid;
  default_role user_role;
BEGIN
  -- הוספת פרופיל למשתמש חדש
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- בדיקה אם המשתמש הוא admin מרכזי (למעט oshritzafriri@gmail.com)
  IF NEW.email = 'oshritzafriri@gmail.com' THEN
    -- משתמש admin מרכזי - לא מקצים עסק או תפקיד רגיל
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;
  
  -- חיפוש עסק של המשתמש (אם קיים)
  SELECT id INTO user_business_id 
  FROM public.businesses 
  WHERE owner_id = NEW.id
  LIMIT 1;
  
  -- קביעת תפקיד ברירת מחדל
  IF user_business_id IS NOT NULL THEN
    -- אם למשתמש יש עסק והוא הראשון בו - הוא OWNER
    IF public.is_first_user_in_business(user_business_id) THEN
      default_role := 'OWNER';
    ELSE
      default_role := 'free_user';
    END IF;
    
    -- הקצאת תפקיד עם עסק
    INSERT INTO public.user_roles (user_id, role, business_id)
    VALUES (NEW.id, default_role, user_business_id);
  ELSE
    -- אם אין עסק - תפקיד ברירת מחדל
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'free_user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- עדכון כל המשתמשים הקיימים (למעט admin) להיות OWNER של העסק שלהם
UPDATE public.user_roles 
SET role = 'OWNER'
WHERE user_id IN (
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  JOIN public.businesses b ON b.owner_id = ur.user_id
  LEFT JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.role != 'admin' 
  AND au.email != 'oshritzafriri@gmail.com'
  AND ur.role != 'OWNER' -- למנוע עדכון כפול
);

-- עדכון פונקציית get_user_role לתמיכה ב-OWNER
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

-- עדכון פונקציית has_role_or_higher לתמיכה ב-OWNER  
CREATE OR REPLACE FUNCTION public.has_role_or_higher(required_role user_role, user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE public.get_user_role(user_uuid)
    WHEN 'admin' THEN true
    WHEN 'OWNER' THEN required_role IN ('OWNER', 'elite_pilot_user', 'smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'elite_pilot_user' THEN required_role IN ('elite_pilot_user', 'smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'smart_master_user' THEN required_role IN ('smart_master_user', 'pro_starter_user', 'free_user')
    WHEN 'pro_starter_user' THEN required_role IN ('pro_starter_user', 'free_user')
    WHEN 'free_user' THEN required_role = 'free_user'
    ELSE false
  END;
$$;

-- הוספת policy חדש לטבלת businesses עבור OWNER
DROP POLICY IF EXISTS "Only OWNER role can create business" ON public.businesses;
DROP POLICY IF EXISTS "Only OWNER role can delete business" ON public.businesses;
DROP POLICY IF EXISTS "Only business owners with OWNER role can update" ON public.businesses;

CREATE POLICY "OWNER can create business" 
ON public.businesses FOR INSERT 
WITH CHECK (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

CREATE POLICY "OWNER can update their business" 
ON public.businesses FOR UPDATE 
USING (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

CREATE POLICY "OWNER can delete their business" 
ON public.businesses FOR DELETE 
USING (
  owner_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);
