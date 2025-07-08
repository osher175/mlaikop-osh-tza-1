
-- Create trigger function for WhatsApp notification when stock reaches zero
CREATE OR REPLACE FUNCTION public.log_whatsapp_notification_stock_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supplier_phone text;
BEGIN
  -- Only proceed if quantity changed to 0 and product has supplier
  IF NEW.quantity = 0 AND OLD.quantity > 0 AND NEW.supplier_id IS NOT NULL THEN
    
    -- Get supplier phone
    SELECT phone INTO supplier_phone
    FROM public.suppliers
    WHERE id = NEW.supplier_id;
    
    -- Insert WhatsApp notification log only if supplier has phone
    IF supplier_phone IS NOT NULL AND supplier_phone != '' THEN
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
        'המוצר ' || NEW.name || ' אזל מהמלאי.',
        '',
        supplier_phone,
        'stock_zero',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER log_whatsapp_notification_stock_zero_trigger
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_whatsapp_notification_stock_zero();
