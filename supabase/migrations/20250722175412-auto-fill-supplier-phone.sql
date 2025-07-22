
-- Create function to auto-fill recipient_phone in whatsapp_notifications_log
CREATE OR REPLACE FUNCTION public.autofill_recipient_phone()
RETURNS trigger AS $$
begin
  -- שלוף את מספר הטלפון של הספק לפי ה-supplier_id שהוזן
  select phone into NEW.recipient_phone
  from suppliers
  where id = NEW.supplier_id;

  return NEW;
end;
$$ LANGUAGE plpgsql;

-- Create trigger to execute the function before insert
CREATE TRIGGER trg_autofill_recipient_phone
  BEFORE INSERT ON public.whatsapp_notifications_log
  FOR EACH ROW
  WHEN (NEW.recipient_phone IS NULL OR NEW.recipient_phone = '')
  EXECUTE FUNCTION public.autofill_recipient_phone();
