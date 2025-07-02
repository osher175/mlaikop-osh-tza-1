
-- הזרקת נתוני עבר לטבלת inventory_actions עבור כל המוצרים הקיימים
INSERT INTO public.inventory_actions (
  product_id,
  action_type,
  quantity_changed,
  user_id,
  business_id,
  notes,
  timestamp
)
SELECT 
  p.id as product_id,
  'add' as action_type,
  p.quantity as quantity_changed,
  p.created_by as user_id,
  p.business_id,
  'הוספת מלאי ראשוני - נתונים קיימים' as notes,
  p.created_at as timestamp
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_actions ia 
  WHERE ia.product_id = p.id
)
AND p.quantity > 0;

-- הוספת אינדקס לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_inventory_actions_product_business 
ON public.inventory_actions(product_id, business_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_actions_business_timestamp 
ON public.inventory_actions(business_id, timestamp DESC);
