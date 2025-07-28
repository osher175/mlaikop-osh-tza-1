
-- First, let's check the existing stock_approvals table structure
-- and create missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_approvals_business_product 
ON public.stock_approvals (business_id, product_id);

CREATE INDEX IF NOT EXISTS idx_stock_approvals_approved 
ON public.stock_approvals (business_id, is_approved);

-- Add RLS policies to stock_approvals table
ALTER TABLE public.stock_approvals ENABLE ROW LEVEL SECURITY;

-- Business owners can manage their stock approvals
CREATE POLICY "Business owners can manage stock approvals"
ON public.stock_approvals
FOR ALL
TO authenticated
USING (business_id IN (
  SELECT id::text FROM public.businesses 
  WHERE owner_id = auth.uid()
))
WITH CHECK (business_id IN (
  SELECT id::text FROM public.businesses 
  WHERE owner_id = auth.uid()
));

-- System can insert stock approvals
CREATE POLICY "System can insert stock approvals"
ON public.stock_approvals
FOR INSERT
TO authenticated
WITH CHECK (true);
