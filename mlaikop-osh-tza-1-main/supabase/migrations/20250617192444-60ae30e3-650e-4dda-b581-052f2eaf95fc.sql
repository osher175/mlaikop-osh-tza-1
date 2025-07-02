
-- Update the notifications table to match your exact requirements
-- First, drop the existing check constraint for type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the channel column
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in-app';

-- Add new check constraints for the updated enum values
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('low_stock', 'expired', 'plan_limit', 'custom'));

ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check 
CHECK (channel IN ('in-app', 'email', 'sms'));

-- Update existing 'expired_product' type values to 'expired' to match your requirement
UPDATE public.notifications SET type = 'expired' WHERE type = 'expired_product';
