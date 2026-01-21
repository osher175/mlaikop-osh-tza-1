-- Atomic RPC function for inventory operations (sale/purchase)
-- Ensures both inventory_actions and products are updated together or not at all

CREATE OR REPLACE FUNCTION public.execute_inventory_transaction(
  p_business_id UUID,
  p_user_id UUID,
  p_product_id UUID,
  p_action_type TEXT, -- 'add' for purchase, 'remove' for sale
  p_quantity_changed INTEGER, -- positive for add, negative for remove
  -- Sale fields (for action_type = 'remove')
  p_sale_total_ils NUMERIC DEFAULT NULL,
  p_sale_unit_ils NUMERIC DEFAULT NULL,
  p_list_unit_ils NUMERIC DEFAULT NULL,
  p_discount_ils NUMERIC DEFAULT NULL,
  p_discount_percent NUMERIC DEFAULT NULL,
  p_cost_snapshot_ils NUMERIC DEFAULT NULL,
  -- Purchase fields (for action_type = 'add')
  p_purchase_unit_ils NUMERIC DEFAULT NULL,
  p_purchase_total_ils NUMERIC DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  -- Common
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_quantity INTEGER;
  v_current_cost NUMERIC;
  v_new_quantity INTEGER;
  v_new_cost NUMERIC;
  v_action_id UUID;
  v_result JSONB;
BEGIN
  -- Validate action_type
  IF p_action_type NOT IN ('add', 'remove') THEN
    RAISE EXCEPTION 'Invalid action_type: %. Must be "add" or "remove"', p_action_type;
  END IF;

  -- Validate required financial data based on action type
  IF p_action_type = 'remove' THEN
    IF p_sale_total_ils IS NULL OR p_cost_snapshot_ils IS NULL THEN
      RAISE EXCEPTION 'Sale (remove) requires sale_total_ils and cost_snapshot_ils';
    END IF;
  ELSIF p_action_type = 'add' THEN
    IF p_purchase_unit_ils IS NULL THEN
      RAISE EXCEPTION 'Purchase (add) requires purchase_unit_ils';
    END IF;
  END IF;

  -- Lock the product row to prevent concurrent modifications
  SELECT quantity, COALESCE(cost, 0)
  INTO v_current_quantity, v_current_cost
  FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Calculate new quantity
  v_new_quantity := v_current_quantity + p_quantity_changed;

  -- Validate that quantity won't go negative
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_quantity, p_quantity_changed;
  END IF;

  -- Calculate new cost (rolling average for purchases)
  IF p_action_type = 'add' AND p_quantity_changed > 0 THEN
    -- Rolling average cost formula: ((old_qty * old_cost) + (new_qty * new_cost)) / total_qty
    IF v_new_quantity > 0 THEN
      v_new_cost := ((v_current_quantity * v_current_cost) + (p_quantity_changed * p_purchase_unit_ils)) / v_new_quantity;
    ELSE
      v_new_cost := p_purchase_unit_ils;
    END IF;
  ELSE
    -- For sales, cost doesn't change
    v_new_cost := v_current_cost;
  END IF;

  -- STEP 1: Insert inventory_actions record FIRST
  INSERT INTO public.inventory_actions (
    id,
    business_id,
    user_id,
    product_id,
    action_type,
    quantity_changed,
    currency,
    -- Sale fields
    sale_total_ils,
    sale_unit_ils,
    list_unit_ils,
    discount_ils,
    discount_percent,
    cost_snapshot_ils,
    -- Purchase fields
    purchase_unit_ils,
    purchase_total_ils,
    supplier_id,
    -- Common
    notes,
    timestamp
  ) VALUES (
    gen_random_uuid(),
    p_business_id,
    p_user_id,
    p_product_id,
    p_action_type,
    p_quantity_changed,
    'ILS',
    -- Sale fields (only for 'remove')
    CASE WHEN p_action_type = 'remove' THEN p_sale_total_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_sale_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_list_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_discount_ils ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_discount_percent ELSE NULL END,
    CASE WHEN p_action_type = 'remove' THEN p_cost_snapshot_ils ELSE NULL END,
    -- Purchase fields (only for 'add')
    CASE WHEN p_action_type = 'add' THEN p_purchase_unit_ils ELSE NULL END,
    CASE WHEN p_action_type = 'add' THEN p_purchase_total_ils ELSE NULL END,
    CASE WHEN p_action_type = 'add' THEN p_supplier_id ELSE NULL END,
    -- Common
    p_notes,
    now()
  )
  RETURNING id INTO v_action_id;

  -- STEP 2: Update products table
  UPDATE public.products
  SET 
    quantity = v_new_quantity,
    cost = v_new_cost,
    updated_at = now()
  WHERE id = p_product_id AND business_id = p_business_id;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'action_id', v_action_id,
    'product_id', p_product_id,
    'action_type', p_action_type,
    'old_quantity', v_current_quantity,
    'new_quantity', v_new_quantity,
    'old_cost', v_current_cost,
    'new_cost', v_new_cost,
    'quantity_changed', p_quantity_changed
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will automatically rollback
    RAISE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_inventory_transaction TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.execute_inventory_transaction IS 
'Atomic function for inventory transactions. Ensures inventory_actions and products are updated together.
action_type: "add" for purchases, "remove" for sales.
All financial data is required based on action_type.';