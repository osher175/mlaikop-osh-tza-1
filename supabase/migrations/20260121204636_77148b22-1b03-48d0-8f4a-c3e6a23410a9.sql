-- Ensure index for insights queries (no-op if already exists)
CREATE INDEX IF NOT EXISTS idx_inventory_actions_business_action_type
ON public.inventory_actions (business_id, action_type, "timestamp" DESC);

-- Aggregated last sale per product for Dead Stock (prevents PostgREST row-limit truncation)
CREATE OR REPLACE FUNCTION public.get_last_sale_at_by_product(p_business_id uuid)
RETURNS TABLE (product_id uuid, last_sale_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ia.product_id, max(ia."timestamp") AS last_sale_at
  FROM public.inventory_actions ia
  WHERE ia.business_id = p_business_id
    AND ia.action_type = 'remove'
  GROUP BY ia.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_sale_at_by_product(uuid) TO authenticated;
