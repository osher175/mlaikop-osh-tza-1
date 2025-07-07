
-- 1. הוספת RLS לטבלת user_businesses (נוכחית חסרה הגנה!)
ALTER TABLE public.user_businesses ENABLE ROW LEVEL SECURITY;

-- 2. מדיניות לקריאה - משתמשים יכולים לראות רק את העסקים שלהם
CREATE POLICY "Users can view their own business relationships"
ON public.user_businesses 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- 3. מדיניות להכנסה - משתמשים יכולים ליצור רק קשרים עם עצמם
CREATE POLICY "Users can create their own business relationships"
ON public.user_businesses 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. מדיניות לעדכון - רק בעלי עסקים יכולים לעדכן סטטוס חברים
CREATE POLICY "Business owners can update member status"
ON public.user_businesses 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.business_id = user_businesses.business_id 
    AND b.owner_id = auth.uid()
  )
);

-- 5. החמרת מדיניות suppliers - הגבלה לפי business_id
DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can view suppliers" ON public.suppliers;

-- יצירת מדיניות מחמירה יותר לספקים
CREATE POLICY "Users can manage suppliers in their business"
ON public.suppliers 
FOR ALL
TO authenticated
USING (
  business_id IS NULL OR -- לתמיכה לאחור בספקים ללא business_id
  business_id IN (
    SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  ) OR
  business_id IN (
    SELECT bu.business_id FROM public.business_users bu 
    WHERE bu.user_id = auth.uid() AND bu.status = 'approved'
  )
)
WITH CHECK (
  business_id IS NULL OR -- לתמיכה לאחור
  business_id IN (
    SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  ) OR
  business_id IN (
    SELECT bu.business_id FROM public.business_users bu 
    WHERE bu.user_id = auth.uid() AND bu.status = 'approved'
  )
);

-- 6. שיפור מדיניות sales_cycles - הרחבת גישה
DROP POLICY IF EXISTS "Users can view sales cycles in their business" ON public.sales_cycles;

CREATE POLICY "Users can view sales cycles in their business"
ON public.sales_cycles 
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  ) OR
  business_id IN (
    SELECT bu.business_id FROM public.business_users bu 
    WHERE bu.user_id = auth.uid() AND bu.status = 'approved'
  )
);

-- הוספת מדיניות להכנסה ועדכון של sales_cycles (למשתמשים מורשים)
CREATE POLICY "Business owners can manage sales cycles"
ON public.sales_cycles
FOR ALL
TO authenticated
USING (
  business_id IN (
    SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  )
);
