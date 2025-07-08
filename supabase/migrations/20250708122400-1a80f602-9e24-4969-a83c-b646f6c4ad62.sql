
-- Add enable_whatsapp_supplier_notification column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS enable_whatsapp_supplier_notification boolean NOT NULL DEFAULT false;

-- Create whatsapp_notifications_log table
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  was_sent boolean NOT NULL DEFAULT false,
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  sales_agent_phone text NOT NULL,
  recipient_phone text NOT NULL,
  trigger_type text DEFAULT 'stock_zero',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on whatsapp_notifications_log
ALTER TABLE public.whatsapp_notifications_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for whatsapp_notifications_log
CREATE POLICY "Users can manage whatsapp notifications for their business"
  ON public.whatsapp_notifications_log
  FOR ALL
  USING (business_id IN (
    SELECT id FROM public.businesses 
    WHERE owner_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT id FROM public.businesses 
    WHERE owner_id = auth.uid()
  ));

-- Add missing columns to suppliers table if they don't exist
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS sales_agent_name text,
ADD COLUMN IF NOT EXISTS sales_agent_phone text;
