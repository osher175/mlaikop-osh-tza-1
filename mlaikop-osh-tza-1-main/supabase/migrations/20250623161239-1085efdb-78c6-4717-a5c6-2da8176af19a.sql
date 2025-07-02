
-- Update the check_expiration_notifications function to use the correct type 'expired'
CREATE OR REPLACE FUNCTION public.check_expiration_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert expiration notifications for products that are expired or expiring soon
  INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
  SELECT DISTINCT
    p.business_id,
    b.owner_id,
    'expired'::text,
    CASE 
      WHEN p.expiration_date < CURRENT_DATE THEN 'מוצר פג תוקף'::text
      ELSE 'מוצר קרוב לפגות תוקף'::text
    END,
    CASE 
      WHEN p.expiration_date < CURRENT_DATE THEN 
        p.name || ' פג תוקף בתאריך ' || to_char(p.expiration_date, 'DD/MM/YYYY')
      ELSE 
        p.name || ' יפוג תוקף בתאריך ' || to_char(p.expiration_date, 'DD/MM/YYYY')
    END,
    p.id
  FROM public.products p
  JOIN public.businesses b ON p.business_id = b.id
  JOIN public.notification_settings ns ON p.business_id = ns.business_id
  WHERE 
    ns.expiration_enabled = true
    AND p.expiration_date IS NOT NULL
    AND p.expiration_date <= CURRENT_DATE + (ns.expiration_days_warning || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n 
      WHERE n.product_id = p.id 
      AND n.type = 'expired' 
      AND n.created_at > now() - interval '24 hours'
    );
END;
$$;

-- Create a trigger function to automatically check for low stock and expiration notifications
CREATE OR REPLACE FUNCTION public.check_product_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  low_stock_threshold_val integer;
  business_owner_id uuid;
BEGIN
  -- Get business owner
  SELECT owner_id INTO business_owner_id 
  FROM public.businesses 
  WHERE id = NEW.business_id;
  
  IF business_owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check for low stock notifications only on quantity changes
  IF TG_OP = 'UPDATE' AND (OLD.quantity IS DISTINCT FROM NEW.quantity) OR TG_OP = 'INSERT' THEN
    -- Get the threshold for this product (from product_thresholds or notification_settings)
    SELECT COALESCE(pt.low_stock_threshold, ns.low_stock_threshold) 
    INTO low_stock_threshold_val
    FROM public.notification_settings ns
    LEFT JOIN public.product_thresholds pt ON pt.product_id = NEW.id
    WHERE ns.business_id = NEW.business_id;
    
    -- If threshold is found and quantity is at or below threshold
    IF low_stock_threshold_val IS NOT NULL AND NEW.quantity <= low_stock_threshold_val THEN
      -- Check if notification doesn't already exist in the last 24 hours
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE product_id = NEW.id 
        AND type = 'low_stock' 
        AND created_at > now() - interval '24 hours'
      ) THEN
        -- Insert low stock notification
        INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
        VALUES (
          NEW.business_id,
          business_owner_id,
          'low_stock',
          'מלאי נמוך',
          'המלאי של ' || NEW.name || ' נמוך מהסף שהוגדר (' || NEW.quantity || ' יחידות)',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  -- Check for expiration notifications
  IF NEW.expiration_date IS NOT NULL THEN
    -- Get expiration warning days
    DECLARE
      warning_days integer;
    BEGIN
      SELECT expiration_days_warning 
      INTO warning_days
      FROM public.notification_settings 
      WHERE business_id = NEW.business_id 
      AND expiration_enabled = true;
      
      -- Check if product is expired or expiring within warning period
      IF warning_days IS NOT NULL AND 
         NEW.expiration_date <= CURRENT_DATE + (warning_days || ' days')::interval THEN
        
        -- Check if notification doesn't already exist in the last 24 hours
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications 
          WHERE product_id = NEW.id 
          AND type = 'expired' 
          AND created_at > now() - interval '24 hours'
        ) THEN
          -- Insert expiration notification
          INSERT INTO public.notifications (business_id, user_id, type, title, message, product_id)
          VALUES (
            NEW.business_id,
            business_owner_id,
            'expired',
            CASE 
              WHEN NEW.expiration_date < CURRENT_DATE THEN 'מוצר פג תוקף'
              ELSE 'מוצר קרוב לפגות תוקף'
            END,
            CASE 
              WHEN NEW.expiration_date < CURRENT_DATE THEN 
                NEW.name || ' פג תוקף בתאריך ' || to_char(NEW.expiration_date, 'DD/MM/YYYY')
              ELSE 
                NEW.name || ' יפוג תוקף בתאריך ' || to_char(NEW.expiration_date, 'DD/MM/YYYY')
            END,
            NEW.id
          );
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on products table
DROP TRIGGER IF EXISTS product_notifications_trigger ON public.products;
CREATE TRIGGER product_notifications_trigger
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_notifications();

-- Ensure notification_settings exist for businesses that don't have them
INSERT INTO public.notification_settings (business_id, low_stock_enabled, expiration_enabled, low_stock_threshold, expiration_days_warning)
SELECT b.id, true, true, 5, 7
FROM public.businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_settings ns WHERE ns.business_id = b.id
);
