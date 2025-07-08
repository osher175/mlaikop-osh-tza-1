
-- הוספת RLS לטבלת user_businesses (שחסרה לחלוטין)
ALTER TABLE public.user_businesses ENABLE ROW LEVEL SECURITY;

-- מדיניות לצפייה - משתמשים יכולים לראות רק את הקשרים העסקיים שלהם
CREATE POLICY "Users can view their own business relationships" 
ON public.user_businesses FOR SELECT 
USING (user_id = auth.uid());

-- מדיניות להוספה - משתמשים יכולים ליצור רק קשרים עסקיים לעצמם
CREATE POLICY "Users can create their own business relationships" 
ON public.user_businesses FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- בעלי עסקים יכולים לעדכן סטטוס חברים
CREATE POLICY "Business owners can update member roles" 
ON public.user_businesses FOR UPDATE 
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- הוספת מדיניות מחמירה יותר לטבלת suppliers
-- הסרת המדיניות הרחבה הקיימת
DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;

-- מדיניות חדשה - רק משתמשים עם גישה לעסק יכולים לנהל ספקים
CREATE POLICY "Users can manage suppliers in their business" 
ON public.suppliers FOR ALL 
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ) OR 
  business_id IN (
    SELECT business_id FROM public.user_businesses 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ) OR 
  business_id IN (
    SELECT business_id FROM public.user_businesses 
    WHERE user_id = auth.uid()
  )
);

-- שיפור מדיניות categories להיות יותר מחמירה
DROP POLICY IF EXISTS "Users can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view categories in their business" ON public.categories;

-- מדיניות חדשה לקטגוריות - רק בהקשר העסקי הרלוונטי
CREATE POLICY "Users can manage categories in their business" 
ON public.categories FOR ALL 
USING (
  business_id IS NULL OR -- קטגוריות כלליות
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ) OR 
  business_id IN (
    SELECT business_id FROM public.user_businesses 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IS NULL OR -- קטגוריות כלליות
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  ) OR 
  business_id IN (
    SELECT business_id FROM public.user_businesses 
    WHERE user_id = auth.uid()
  )
);
