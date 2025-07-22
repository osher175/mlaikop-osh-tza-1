
-- Enable http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http;

-- Create or replace the notify_out_of_stock function with correct implementation
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
    
    -- Build JSON request body
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
    
    -- Send POST request to Edge Function
    SELECT INTO response public.http_post(
      'https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/clever-service',
      request_body,
      headers
    );
    
    -- Log the response for debugging
    RAISE NOTICE 'Webhook response - Status: %, Content: %', response.status, response.content;
    
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
        'Webhook sent successfully for out of stock product: ' || NEW.name,
        '',
        '',
        'webhook_out_of_stock',
        true
      );
    END IF;
    
  end if;

  return NEW;
end;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_product_out_of_stock ON public.products;

-- Create the trigger
CREATE TRIGGER trg_product_out_of_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_out_of_stock();
