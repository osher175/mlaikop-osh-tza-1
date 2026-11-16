-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute on production.
-- Replaces execute_inventory_transaction with the same authorization, quantity,
-- and idempotency behavior. The only change is purchase cost:
-- a null cost stays null, and an explicit 0 stays 0.
-- Existing product rows are not updated by applying this file.
-- Refuses to replace a function body that no longer matches this correction.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $guard$
BEGIN
  IF to_regprocedure('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'execute_inventory_transaction is missing';
  END IF;
  IF position('salesperson_employee_id' in pg_get_functiondef('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'execute_inventory_transaction contains salesperson logic this correction does not include';
  END IF;
  IF position('COALESCE(cost, 0)' in pg_get_functiondef('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)'::regprocedure)) = 0
     AND position('Unknown units already on hand' in pg_get_functiondef('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'execute_inventory_transaction does not match this cost correction';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.execute_inventory_transaction(
  p_business_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_action_type text,
  p_quantity_changed integer,
  p_sale_total_ils numeric DEFAULT NULL,
  p_sale_unit_ils numeric DEFAULT NULL,
  p_list_unit_ils numeric DEFAULT NULL,
  p_discount_ils numeric DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,
  p_cost_snapshot_ils numeric DEFAULT NULL,
  p_purchase_unit_ils numeric DEFAULT NULL,
  p_purchase_total_ils numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_meta jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
  v_jwt_role TEXT := auth.role();
  v_actor UUID;
  v_current_quantity INTEGER;
  v_current_cost NUMERIC;
  v_new_quantity INTEGER;
  v_new_cost NUMERIC;
  v_action_id UUID;
  v_existing_product UUID;
  v_existing_type TEXT;
  v_existing_qty INTEGER;
  v_result JSONB;
BEGIN
  -- p_user_id is not authorization. PostgREST's login is authenticator.
  -- auth.role() is the role from the verified JWT, not a request header.
  IF session_user IS DISTINCT FROM 'authenticator' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_jwt_role = 'authenticated' AND v_caller IS NOT NULL THEN
    v_actor := v_caller;
  ELSIF v_jwt_role = 'service_role' AND v_caller IS NOT NULL THEN
    v_actor := v_caller;
  ELSIF v_jwt_role = 'service_role' AND v_caller IS NULL THEN
    v_actor := p_user_id;
  ELSE
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NULL OR p_business_id IS NULL
     OR NOT public.is_active_business_actor(p_business_id, v_actor) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;

  IF p_action_type NOT IN ('add', 'remove', 'adjust') THEN
    RAISE EXCEPTION 'Invalid action_type: %. Must be "add", "remove" or "adjust"', p_action_type;
  END IF;

  IF p_action_type = 'remove' THEN
    IF p_sale_total_ils IS NULL OR p_cost_snapshot_ils IS NULL THEN
      RAISE EXCEPTION 'Sale (remove) requires sale_total_ils and cost_snapshot_ils';
    END IF;
  ELSIF p_action_type = 'add' THEN
    IF p_purchase_unit_ils IS NULL THEN
      RAISE EXCEPTION 'Purchase (add) requires purchase_unit_ils';
    END IF;
  END IF;

  SELECT quantity, cost
  INTO v_current_quantity, v_current_cost
  FROM public.products
  WHERE id = p_product_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF p_reference_type = 'editor_operation' AND p_reference_id IS NOT NULL THEN
    SELECT ia.id, ia.product_id, ia.action_type, ia.quantity_changed
    INTO v_action_id, v_existing_product, v_existing_type, v_existing_qty
    FROM public.inventory_actions ia
    WHERE ia.business_id = p_business_id
      AND ia.reference_type = 'editor_operation'
      AND ia.reference_id = p_reference_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_product IS DISTINCT FROM p_product_id
         OR v_existing_type IS DISTINCT FROM p_action_type
         OR v_existing_qty IS DISTINCT FROM p_quantity_changed THEN
        RAISE EXCEPTION 'operation key already used for a different change';
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'replayed', true,
        'action_id', v_action_id,
        'product_id', p_product_id,
        'action_type', p_action_type,
        'new_quantity', v_current_quantity,
        'new_cost', v_current_cost,
        'quantity_changed', p_quantity_changed
      );
    END IF;
  END IF;

  v_new_quantity := v_current_quantity + p_quantity_changed;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_quantity, p_quantity_changed;
  END IF;

  -- Null stays null. Zero stays zero. A missing cost is not a new cost.
  -- An add blends only when the current cost is known, or when no units remain.
  -- Unknown units already on hand are not valued at zero.
  IF p_action_type = 'add' AND p_quantity_changed > 0 THEN
    IF v_current_cost IS NULL AND v_current_quantity > 0 THEN
      v_new_cost := NULL;
    ELSIF v_new_quantity > 0 THEN
      v_new_cost := ((v_current_quantity * COALESCE(v_current_cost, 0)) + (p_quantity_changed * p_purchase_unit_ils)) / v_new_quantity;
    ELSE
      v_new_cost := p_purchase_unit_ils;
    END IF;
  ELSE
    v_new_cost := v_current_cost;
  END IF;

  BEGIN
    INSERT INTO public.inventory_actions (
      id, business_id, user_id, product_id, action_type, quantity_changed, currency,
      sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent, cost_snapshot_ils,
      purchase_unit_ils, purchase_total_ils, supplier_id, notes, timestamp,
      source, reference_type, reference_id, reference_meta
    ) VALUES (
      gen_random_uuid(), p_business_id, v_actor, p_product_id, p_action_type, p_quantity_changed, 'ILS',
      CASE WHEN p_action_type = 'remove' THEN p_sale_total_ils ELSE NULL END,
      CASE WHEN p_action_type = 'remove' THEN p_sale_unit_ils ELSE NULL END,
      CASE WHEN p_action_type = 'remove' THEN p_list_unit_ils ELSE NULL END,
      CASE WHEN p_action_type = 'remove' THEN p_discount_ils ELSE NULL END,
      CASE WHEN p_action_type = 'remove' THEN p_discount_percent ELSE NULL END,
      CASE WHEN p_action_type = 'remove' THEN p_cost_snapshot_ils ELSE NULL END,
      CASE WHEN p_action_type = 'add' THEN p_purchase_unit_ils ELSE NULL END,
      CASE WHEN p_action_type = 'add' THEN p_purchase_total_ils ELSE NULL END,
      CASE WHEN p_action_type = 'add' THEN p_supplier_id ELSE NULL END,
      p_notes, now(),
      p_source, p_reference_type, p_reference_id, p_reference_meta
    )
    RETURNING id INTO v_action_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT ia.id INTO v_action_id
      FROM public.inventory_actions ia
      WHERE ia.business_id = p_business_id
        AND ia.reference_type = 'editor_operation'
        AND ia.reference_id = p_reference_id;
      IF v_action_id IS NULL THEN
        RAISE;
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'replayed', true,
        'action_id', v_action_id,
        'product_id', p_product_id,
        'action_type', p_action_type,
        'new_quantity', v_current_quantity,
        'new_cost', v_current_cost,
        'quantity_changed', p_quantity_changed
      );
  END;

  UPDATE public.products
  SET quantity = v_new_quantity,
      cost = v_new_cost,
      updated_at = now()
  WHERE id = p_product_id AND business_id = p_business_id;

  v_result := jsonb_build_object(
    'success', true,
    'replayed', false,
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
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_inventory_transaction(
  uuid, uuid, uuid, text, integer, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_inventory_transaction(
  uuid, uuid, uuid, text, integer, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, uuid, text, text, text, uuid, jsonb)
  TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.inventory_sales_require_known_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $known_sale$
BEGIN
  IF COALESCE(NEW.is_reversal, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.action_type IN ('sale', 'remove')
     AND NEW.cost_snapshot_ils IS NULL
     AND (NEW.sale_total_ils IS NOT NULL OR NEW.reference_type = 'sale_transaction') THEN
    RAISE EXCEPTION 'known cost is required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$known_sale$;

REVOKE ALL ON FUNCTION public.inventory_sales_require_known_cost() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_inventory_sales_require_known_cost ON public.inventory_actions;
CREATE TRIGGER trg_inventory_sales_require_known_cost
  BEFORE INSERT ON public.inventory_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.inventory_sales_require_known_cost();

CREATE OR REPLACE FUNCTION public.set_product_purchase_cost(
  p_business_id uuid,
  p_product_id uuid,
  p_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $set_cost$
DECLARE
  v_uid uuid := auth.uid();
  v_quantity integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_product_id IS NULL OR p_cost IS NULL OR p_cost < 0 THEN
    RAISE EXCEPTION 'explicit purchase cost is required';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  UPDATE public.products
  SET cost = p_cost, updated_at = now()
  WHERE id = p_product_id AND business_id = p_business_id
  RETURNING quantity INTO v_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;
  RETURN jsonb_build_object('product_id', p_product_id, 'cost', p_cost, 'quantity', v_quantity);
END;
$set_cost$;

REVOKE ALL ON FUNCTION public.set_product_purchase_cost(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_purchase_cost(uuid, uuid, numeric) TO authenticated;

COMMIT;
