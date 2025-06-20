
-- שלב 1: הוספת שדות חסרים לטבלת businesses (אם עדיין לא קיימים)
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS avg_monthly_revenue DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS official_email TEXT,
ADD COLUMN IF NOT EXISTS employee_count INTEGER DEFAULT 1;

-- שלב 2: תיקון שמות עסקים כפולים
WITH duplicated_businesses AS (
  SELECT id, name, 
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as row_num
  FROM public.businesses
  WHERE name IN (
    SELECT name 
    FROM public.businesses 
    GROUP BY name 
    HAVING COUNT(*) > 1
  )
)
UPDATE public.businesses 
SET name = CASE 
  WHEN db.row_num = 1 THEN db.name
  ELSE db.name || ' (' || db.row_num || ')'
END
FROM duplicated_businesses db
WHERE businesses.id = db.id
AND db.row_num > 1;

-- שלב 3: הוספת UNIQUE constraint על שם העסק
ALTER TABLE public.businesses 
DROP CONSTRAINT IF EXISTS businesses_name_unique;
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_name_unique UNIQUE (name);

-- שלב 4: הוספת עמודה לקישור profile לעסק (כבעלים)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS owned_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

-- שלב 5: הוספת UNIQUE constraint כדי לוודא קשר 1:1
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_owned_business_unique;
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_owned_business_unique UNIQUE (owned_business_id);

-- שלב 6: עדכון הנתונים הקיימים - קישור profiles לעסקים שלהם
UPDATE public.profiles 
SET owned_business_id = b.id
FROM public.businesses b
WHERE profiles.id = b.owner_id
AND profiles.owned_business_id IS NULL;

-- שלב 7: כעת נבצע את העברת הבעלות
-- ביטול קישור הבעלים הקודם (oshritzafriri@gmail.com)
UPDATE public.profiles
SET owned_business_id = NULL
WHERE id IN (
  SELECT p.id 
  FROM public.profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE UPPER(au.email) = 'OSHRITZAFRIRI@GMAIL.COM'
);

-- העברת בעלות העסק לבעלים החדש (lidortzafriri@gmail.com)
UPDATE public.businesses
SET owner_id = (
  SELECT au.id 
  FROM auth.users au
  WHERE UPPER(au.email) = 'LIDORTZAFRIRI@GMAIL.COM'
)
WHERE name = 'צמיגי פאר';

-- קישור הפרופיל החדש לעסק
UPDATE public.profiles
SET owned_business_id = (
  SELECT id 
  FROM public.businesses 
  WHERE name = 'צמיגי פאר'
)
WHERE id IN (
  SELECT p.id 
  FROM public.profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE UPPER(au.email) = 'LIDORTZAFRIRI@GMAIL.COM'
);

-- שלב 8: אימות התוצאות
SELECT 
  b.name as business_name,
  b.owner_id,
  au_owner.email as owner_email,
  p_owner.owned_business_id
FROM public.businesses b
JOIN auth.users au_owner ON b.owner_id = au_owner.id
JOIN public.profiles p_owner ON au_owner.id = p_owner.id
WHERE b.name = 'צמיגי פאר';
