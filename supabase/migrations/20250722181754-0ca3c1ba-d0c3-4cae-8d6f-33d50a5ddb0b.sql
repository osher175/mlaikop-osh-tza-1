
-- שלב 1: יצירת טבלה חדשה במסד הנתונים בשם stock_approval_requests
CREATE TABLE public.stock_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  supplier_id uuid REFERENCES suppliers(id),
  product_name text,
  quantity integer,
  status text DEFAULT 'pending', -- אפשרויות: 'pending', 'approved', 'rejected'
  created_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz
);

-- שלב 2: עדכון הפונקציה notify_out_of_stock כך שתרשום בקשה בטבלה החדשה
CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN
    INSERT INTO public.stock_approval_requests (
      product_id, supplier_id, product_name, quantity
    ) VALUES (
      NEW.id, NEW.supplier_id, NEW.name, NEW.quantity
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- שלב 4: יצירת טריגר שישלח webhook כאשר בקשה מאושרת
CREATE OR REPLACE FUNCTION public.process_approved_stock_request()
RETURNS trigger AS $$
DECLARE
  response http_response;
  request_body text;
  headers text;
BEGIN
  -- רק אם הסטטוס שונה ל-approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    
    -- בניית גוף הבקשה
    request_body := json_build_object(
      'product_id', NEW.product_id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'supplier_id', NEW.supplier_id
    )::text;
    
    -- בניית כותרות עם Bearer token
    headers := json_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
      'Content-Type', 'application/json'
    )::text;
    
    -- שליחת בקשת POST לפונקציית Edge
    SELECT INTO response public.http_post(
      'https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/clever-service',
      request_body,
      headers
    );
    
    -- רישום התגובה לצורך בדיקות
    RAISE NOTICE 'Webhook response for approved request - Status: %, Content: %', response.status, response.content;
    
    -- רישום לטבלת התראות ווטסאפ אם התגובה הצליחה
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
      FROM products p
      LEFT JOIN suppliers s ON s.id = NEW.supplier_id
      WHERE p.id = NEW.product_id;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- יצירת הטריגר החדש
CREATE TRIGGER trg_process_approved_stock_request
  AFTER UPDATE ON public.stock_approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.process_approved_stock_request();

-- הוספת RLS לטבלה החדשה
ALTER TABLE public.stock_approval_requests ENABLE ROW LEVEL SECURITY;

-- פוליסת הרשאות - משתמשים יכולים לראות ולעדכן בקשות בעסק שלהם
CREATE POLICY "Users can view stock approval requests for their business" 
ON public.stock_approval_requests
FOR SELECT
USING (
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

CREATE POLICY "Users can update stock approval requests for their business" 
ON public.stock_approval_requests
FOR UPDATE
USING (
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
