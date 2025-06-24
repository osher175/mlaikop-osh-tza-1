
-- הוספת עמודה חדשה עבור קטגוריות מוצרים החדשות
ALTER TABLE public.products 
ADD COLUMN product_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- הוספת אינדקס לביצועים טובים יותר
CREATE INDEX idx_products_product_category_id ON public.products(product_category_id);

-- הוספת הערה להבהיר את ההבדל בין השדות
COMMENT ON COLUMN public.products.category_id IS 'Legacy category reference to categories table';
COMMENT ON COLUMN public.products.product_category_id IS 'New category reference to product_categories table';
