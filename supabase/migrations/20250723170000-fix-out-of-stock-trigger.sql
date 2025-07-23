
-- Update the notify_out_of_stock function to call clever-service and prevent duplicates
CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  response http_response;
  request_body text;
  headers text;
begin
  -- Only proceed if quantity changed from > 0 to 0
  if NEW.quantity = 0 and OLD.quantity > 0 then
    
    -- Check if we already have a pending request for this product to prevent duplicates
    if NOT EXISTS (
      SELECT 1 FROM public.stock_approval_requests 
      WHERE product_id = NEW.id 
      AND status = 'pending'
      AND created_at > now() - interval '1 hour'
    ) then
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
    end if;
    
    -- Build JSON request body for clever-service
    request_body := json_build_object(
      'product_id', NEW.id,
      'product_name', NEW.name,
      'quantity', NEW.quantity,
      'supplier_id', NEW.supplier_id
    )::text;
    
    -- Build headers with correct Bearer token
    headers := json_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
      'Content-Type', 'application/json'
    )::text;
    
    -- Send POST request to clever-service Edge Function
    SELECT INTO response public.http_post(
      'https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/clever-service',
      request_body,
      headers
    );
    
    -- Log the response for debugging
    RAISE NOTICE 'Clever-service response - Status: %, Content: %', response.status, response.content;
    
    -- Log to whatsapp_notifications_log table if response is successful
    IF response.status >= 200 AND response.status < 300 THEN
      INSERT INTO public.whatsapp_notifications_log (
        business_id,
        product_id,
        supplier_id,
        message_text,
        sales_agent_phone,
        recipient_phone,
        trigger_type,
        was_sent
      ) VALUES (
        NEW.business_id,
        NEW.id,
        NEW.supplier_id,
        'Clever-service called successfully for out of stock product: ' || NEW.name,
        '',
        '',
        'clever_service_out_of_stock',
        true
      );
    ELSE
      -- Log failed attempts as well
      INSERT INTO public.whatsapp_notifications_log (
        business_id,
        product_id,
        supplier_id,
        message_text,
        sales_agent_phone,
        recipient_phone,
        trigger_type,
        was_sent
      ) VALUES (
        NEW.business_id,
        NEW.id,
        NEW.supplier_id,
        'Clever-service call failed for out of stock product: ' || NEW.name || ' (Status: ' || response.status || ')',
        '',
        '',
        'clever_service_out_of_stock_failed',
        false
      );
    END IF;
    
  end if;

  return NEW;
end;
$$;

-- Drop and recreate the trigger to ensure it's properly configured
DROP TRIGGER IF EXISTS trg_notify_out_of_stock ON public.products;
CREATE TRIGGER trg_notify_out_of_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_out_of_stock();
