-- Function: public.fill_business_ids()

CREATE OR REPLACE FUNCTION public.fill_business_ids()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated AS (
    UPDATE inventory_actions
    SET business_id = profiles.business_id
    FROM profiles
    WHERE inventory_actions.user_id = profiles.id
      AND inventory_actions.business_id IS NULL
      AND profiles.business_id IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN updated_count;
END;
$$; 