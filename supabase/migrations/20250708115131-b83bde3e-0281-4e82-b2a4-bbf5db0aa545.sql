
-- Create notification_targets table for assigning users to specific notifications
CREATE TABLE public.notification_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_setting_id uuid REFERENCES public.notification_settings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(notification_setting_id, user_id)
);

-- Add missing columns to notification_settings table
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS whatsapp_to_supplier boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'low_stock',
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add constraint for notification_type
ALTER TABLE public.notification_settings 
ADD CONSTRAINT notification_settings_type_check 
CHECK (notification_type IN ('low_stock', 'expired', 'expiring_soon', 'unusual_activity'));

-- Enable RLS on notification_targets
ALTER TABLE public.notification_targets ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_targets
CREATE POLICY "Users can manage notification targets for their business" 
  ON public.notification_targets 
  FOR ALL 
  USING (
    notification_setting_id IN (
      SELECT ns.id FROM public.notification_settings ns
      JOIN public.businesses b ON ns.business_id = b.id
      WHERE b.owner_id = auth.uid()
    )
  );
