
-- יצירת טבלת קטגוריות עסקים
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- הוספת שדה business_category_id לטבלת businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS business_category_id UUID REFERENCES business_categories(id) ON DELETE SET NULL;

-- יצירת טבלת קטגוריות מוצרים לפי תחום העסק
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_category_id UUID NOT NULL REFERENCES business_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- הוספת נתונים ראשוניים לדוגמה
INSERT INTO public.business_categories (name) VALUES
('מוסך ומרכז שירות'),
('מכולת ומינימרקט'),
('בגדים ונעליים'),
('ציוד טכני ומחשבים'),
('בית מרקחת'),
('מסעדה ובית קפה'),
('חנות ספרים וכתבי עת')
ON CONFLICT (name) DO NOTHING;

-- הוספת קטגוריות מוצרים למוסך
DO $$
DECLARE
    garage_category_id UUID;
BEGIN
    SELECT id INTO garage_category_id FROM public.business_categories WHERE name = 'מוסך ומרכז שירות';
    
    IF garage_category_id IS NOT NULL THEN
        INSERT INTO public.product_categories (name, business_category_id) VALUES
        ('צמיגי רכב B', garage_category_id),
        ('צמיג רכב מסחרי', garage_category_id),
        ('צמיג משא קל', garage_category_id),
        ('צמיג נוסעים כבד', garage_category_id),
        ('צמיג תעשייתי צמ״ה', garage_category_id),
        ('צמיג 70-30', garage_category_id),
        ('צמיג טרקטורון', garage_category_id),
        ('שמנים ונוזלים', garage_category_id),
        ('חלפים ומסנים', garage_category_id),
        ('בלמים ומזלגות', garage_category_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- הפעלת RLS על הטבלאות החדשות
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- מדיניות לקטגוריות עסקים - כל המשתמשים יכולים לראות
CREATE POLICY "Users can view business categories"
  ON public.business_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- מדיניות לקטגוריות מוצרים - כל המשתמשים יכולים לראות
CREATE POLICY "Users can view product categories"
  ON public.product_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- מדיניות להוספת קטגוריות מוצרים חדשות
CREATE POLICY "Users can create product categories"
  ON public.product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
