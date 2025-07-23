
-- First, let's check the current trigger that's causing the issue
-- The notify_out_of_stock trigger is trying to insert into stock_approval_requests
-- but there's no INSERT policy for it

-- Add INSERT policy for stock_approval_requests table to allow system insertions
CREATE POLICY "System can insert stock approval requests" 
ON public.stock_approval_requests 
FOR INSERT 
WITH CHECK (true);

-- Also add a policy for users to insert their own requests
CREATE POLICY "Users can create stock approval requests for their business" 
ON public.stock_approval_requests 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products p
    JOIN businesses b ON p.business_id = b.id
    WHERE p.id = stock_approval_requests.product_id 
    AND (b.owner_id = auth.uid() OR b.id IN (
      SELECT business_id FROM business_users 
      WHERE user_id = auth.uid() AND status = 'approved'
    ))
  )
);

-- Let's also check if we need to update the notify_out_of_stock function
-- to ensure it works properly with the current schema
CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if quantity changed from > 0 to 0
  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN
    
    -- Insert into stock_approval_requests table
    INSERT INTO public.stock_approval_requests (
      product_id, 
      supplier_id, 
      product_name, 
      quantity
    ) VALUES (
      NEW.id, 
      NEW.supplier_id, 
      NEW.name, 
      NEW.quantity
    );
    
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trg_notify_out_of_stock ON public.products;
CREATE TRIGGER trg_notify_out_of_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_out_of_stock();
