CREATE OR REPLACE FUNCTION public.reverse_inventory_action(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action RECORD;
  v_user UUID := auth.uid();
  v_is_member BOOLEAN;
  v_is_admin BOOLEAN;
  v_new_qty INTEGER;
  v_reversal_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_action FROM public.inventory_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action not found';
  END IF;

  IF v_action.is_reversal THEN
    RAISE EXCEPTION 'Cannot reverse a reversal';
  END IF;
  IF v_action.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Action already reversed';
  END IF;
  IF v_action.action_type NOT IN ('remove','sale') THEN
    RAISE EXCEPTION 'Only sales/removals can be reversed via this action';
  END IF;
  IF now() - v_action.timestamp > interval '10 minutes' THEN
    RAISE EXCEPTION 'Undo window (10 minutes) has expired';
  END IF;

  -- Permission: original user, or owner/admin of the business, or platform admin
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.business_id = v_action.business_id
      AND bu.user_id = v_user
      AND bu.role IN ('owner','admin')
  ) INTO v_is_member;

  v_is_admin := public.has_role_or_higher('admin'::public.user_role, v_user);

  IF v_action.user_id <> v_user AND NOT v_is_member AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized to reverse this action';
  END IF;

  UPDATE public.products
    SET quantity = quantity - v_action.quantity_changed,
        updated_at = now()
    WHERE id = v_action.product_id AND business_id = v_action.business_id
    RETURNING quantity INTO v_new_qty;

  INSERT INTO public.inventory_actions (
    business_id, user_id, product_id, action_type, quantity_changed,
    currency, sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent,
    cost_snapshot_ils, notes, timestamp,
    is_reversal, reverses_action_id
  ) VALUES (
    v_action.business_id, v_user, v_action.product_id, v_action.action_type,
    -v_action.quantity_changed,
    v_action.currency, v_action.sale_total_ils, v_action.sale_unit_ils, v_action.list_unit_ils,
    v_action.discount_ils, v_action.discount_percent, v_action.cost_snapshot_ils,
    'ביטול פעולה', now(),
    true, v_action.id
  )
  RETURNING id INTO v_reversal_id;

  UPDATE public.inventory_actions
    SET reversed_at = now(), reversed_by = v_user
    WHERE id = v_action.id;

  RETURN jsonb_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'action_id', v_action.id,
    'new_quantity', v_new_qty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reverse_inventory_action(UUID) TO authenticated;