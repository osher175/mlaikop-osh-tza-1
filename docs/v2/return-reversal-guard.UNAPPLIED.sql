-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- A full reversal restores the original sold quantity. A partial customer
-- return may already have put some or all of those units back, or recorded
-- them as damaged. Applying both would restore more than the sale deducted.
-- This file rejects the full reversal after any customer return, restocked
-- or damaged. It does not rewrite the sale, the return, or the stock.
--
-- Depends on docs/v2/inventory-lifecycle.UNAPPLIED.sql only for the meaning
-- of reference_type customer_return. The check is safe before that file:
-- with no such rows, reversal behaves as it does today.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

  -- Held under the row lock above, so a concurrent partial return waits.
  IF EXISTS (
    SELECT 1 FROM public.inventory_actions r
    WHERE r.business_id = v_action.business_id
      AND r.reference_type = 'customer_return'
      AND r.reference_meta->>'original_action_id' = v_action.id::text
  ) THEN
    RAISE EXCEPTION 'full reversal is closed after a partial return' USING ERRCODE = '23514';
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

CREATE OR REPLACE FUNCTION public.reverse_quick_sale(p_business_id uuid, p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $reverse$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_created_by uuid;
  v_allowed boolean;
  v_line record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_transaction_id IS NULL THEN
    RAISE EXCEPTION 'invalid reversal';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  SELECT status, created_by INTO v_status, v_created_by
  FROM public.sale_transactions
  WHERE id = p_transaction_id AND business_id = p_business_id
  FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'sale not found';
  END IF;

  v_allowed := v_created_by = v_uid
    OR EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = p_business_id AND b.owner_id = v_uid
    )
    OR EXISTS (
      SELECT 1 FROM public.business_users bu
      WHERE bu.business_id = p_business_id
        AND bu.user_id = v_uid
        AND bu.role IN ('owner', 'admin')
    );
  IF v_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF v_status = 'reversed' THEN
    RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', true);
  END IF;

  PERFORM a.id
  FROM public.inventory_actions a
  WHERE a.business_id = p_business_id
    AND a.id IN (
      SELECT l.inventory_action_id
      FROM public.sale_lines l
      WHERE l.transaction_id = p_transaction_id AND l.business_id = p_business_id
    )
  ORDER BY a.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_actions r
    JOIN public.sale_lines l
      ON l.inventory_action_id::text = r.reference_meta->>'original_action_id'
     AND l.business_id = r.business_id
    WHERE r.business_id = p_business_id
      AND r.reference_type = 'customer_return'
      AND l.transaction_id = p_transaction_id
  ) THEN
    RAISE EXCEPTION 'full reversal is closed after a partial return' USING ERRCODE = '23514';
  END IF;

  PERFORM p.id
  FROM public.products p
  JOIN public.sale_lines l ON l.product_id = p.id AND l.business_id = p.business_id
  WHERE l.transaction_id = p_transaction_id AND l.business_id = p_business_id
  ORDER BY p.id
  FOR UPDATE;

  PERFORM set_config('mlaiko.quick_sale_reversal', 'on', true);

  FOR v_line IN
    SELECT product_id, quantity, inventory_action_id, unit_cost_ils
    FROM public.sale_lines
    WHERE transaction_id = p_transaction_id AND business_id = p_business_id
    ORDER BY position
  LOOP
    UPDATE public.products
    SET quantity = quantity + v_line.quantity,
        updated_at = now()
    WHERE id = v_line.product_id AND business_id = p_business_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product missing; reversal aborted';
    END IF;

    UPDATE public.inventory_actions
    SET reversed_at = now(),
        reversed_by = v_uid
    WHERE id = v_line.inventory_action_id
      AND business_id = p_business_id
      AND reversed_at IS NULL
      AND reference_type = 'sale_transaction'
      AND reference_id = p_transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sale movement missing; reversal aborted';
    END IF;

    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      cost_snapshot_ils, notes, timestamp, reference_type, reference_id, source,
      is_reversal, reverses_action_id
    ) VALUES (
      p_business_id, v_uid, v_line.product_id, 'sale', v_line.quantity, 'ILS',
      v_line.unit_cost_ils, 'quick sale reversal', now(),
      'sale_transaction', p_transaction_id, 'sale_transaction',
      true, v_line.inventory_action_id
    );
  END LOOP;

  UPDATE public.sale_transactions
  SET status = 'reversed',
      reversed_at = now(),
      reversed_by = v_uid
  WHERE id = p_transaction_id
    AND business_id = p_business_id
    AND status = 'completed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale reversal was not recorded';
  END IF;

  RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', false);
END;
$reverse$;

GRANT EXECUTE ON FUNCTION public.reverse_inventory_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_quick_sale(uuid, uuid) TO authenticated, service_role;

COMMIT;
