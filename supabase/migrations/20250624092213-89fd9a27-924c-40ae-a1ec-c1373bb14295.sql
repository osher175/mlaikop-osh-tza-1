
-- שלב 1: הסרת הקשרים הישנים מטבלת products
ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS products_category_id_fkey;

-- הסרת העמודה category_id מטבלת products (מאחר שהיא לא בשימוש עוד)
ALTER TABLE public.products 
DROP COLUMN IF EXISTS category_id;

-- בדיקה והסרת הקשר מטבלת recent_activity אם קיים
ALTER TABLE public.recent_activity 
DROP CONSTRAINT IF EXISTS recent_activity_category_id_fkey;

-- הסרת העמודה category_id מטבלת recent_activity אם קיימת
ALTER TABLE public.recent_activity 
DROP COLUMN IF EXISTS category_id;

-- הערה על העמודה החדשה product_category_id
COMMENT ON COLUMN public.products.product_category_id IS 'Category reference to product_categories table - this is the only category field in use';
