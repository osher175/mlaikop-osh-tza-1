CREATE OR REPLACE FUNCTION public.process_approved_stock_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  response http_response;
  request_body text;
  headers text;
  v_business_id uuid;
  v_billing_status text;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

    -- Resolve business_id from product
    SELECT p.business_id INTO v_business_id
    FROM public.products p
    WHERE p.id = NEW.product_id;

    -- Billing gate: only active/trial businesses trigger the external webhook.
    -- We use business_billing_status (non-raising) so the trigger never fails
    -- the approval write itself.
    IF v_business_id IS NOT NULL THEN
      BEGIN
        v_billing_status := public.business_billing_status(v_business_id);
      EXCEPTION WHEN OTHERS THEN
        v_billing_status := 'none';
      END;

      IF v_billing_status NOT IN ('active', 'trial') THEN
        -- Log skip, do NOT send webhook, do NOT raise.
        BEGIN
          INSERT INTO public.billing_events (
            business_id, event_type, source, metadata
          ) VALUES (
            v_business_id,
            'billing_gate_blocked_action',
            'process_approved_stock_request',
            jsonb_build_object(
              'action', 'clever_service_webhook',
              'product_id', NEW.product_id,
              'billing_status', v_billing_status
            )
          );
        EXCEPTION WHEN OTHERS THEN
          -- never block the approval on logging failures
          NULL;
        END;
        RETURN NEW;
      END IF;
    END IF;

    -- Build identical payload as before (unchanged)
    request_body := json_build_object(
      'product_id', NEW.product_id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'supplier_id', NEW.supplier_id
    )::text;

    headers := json_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
      'Content-Type', 'application/json'
    )::text;

    SELECT INTO response public.http_post(
      'https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/clever-service',
      request_body,
      headers
    );

    IF response.status >= 200 AND response.status < 300 THEN
      INSERT INTO public.whatsapp_notifications_log (
        business_id, product_id, supplier_id, message_text,
        sales_agent_phone, recipient_phone, trigger_type, was_sent
      )
      SELECT
        p.business_id,
        NEW.product_id,
        NEW.supplier_id,
        'הודעה נשלחה לאחר אישור ידני עבור המוצר: ' || NEW.product_name,
        '',
        s.phone,
        'manual_approval_out_of_stock',
        true
      FROM public.products p
      LEFT JOIN public.suppliers s ON s.id = NEW.supplier_id
      WHERE p.id = NEW.product_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;