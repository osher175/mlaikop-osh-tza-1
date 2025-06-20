
-- Add alert_dismissed column to existing products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS alert_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- Update the image column to be more descriptive (it already exists as 'image')
-- No changes needed as 'image' field already exists

-- Add index for better performance on expiration queries
CREATE INDEX IF NOT EXISTS idx_products_expiration_alerts 
ON public.products(expiration_date, alert_dismissed) 
WHERE expiration_date IS NOT NULL;

-- Add index for better performance on business queries
CREATE INDEX IF NOT EXISTS idx_products_business_created 
ON public.products(business_id, created_at);
