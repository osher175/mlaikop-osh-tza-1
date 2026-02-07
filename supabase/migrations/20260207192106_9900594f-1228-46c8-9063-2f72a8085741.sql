
-- Expand notifications type constraint to include procurement types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('low_stock', 'expired', 'plan_limit', 'custom', 'procurement_quote', 'procurement_order'));
