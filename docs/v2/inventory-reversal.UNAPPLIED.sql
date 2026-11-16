-- UNAPPLIED. Do not copy into supabase/migrations and do not run on production.
-- Run only after docs/v2/user-businesses-insert-lock.UNAPPLIED.sql on an isolated
-- database whose backup has been confirmed. Production PITR is UNVERIFIED.
--
-- Replaces reverse_inventory_action so a reversal cannot drive stock negative,
-- locks the product row, and stops when the product row is missing.
-- Authorization stays narrower than is_active_business_actor:
--   * the original actor, while they are still an actor of that business
--   * the business owner
--   * a business_users row whose role is owner or admin
--   * a global platform admin
-- An approved member who did not make the sale cannot reverse it.
--
-- Platform admin is kept because the migration that added
-- is_active_business_actor marks that path as intentional. Removing it is
-- blocked until a support workflow is confirmed. This file does not replace
-- is_active_business_actor and does not change product RLS. Role vocabulary
-- on business_users is a job title in the join form, so a broader RLS change
-- is blocked until production role values are verified.
--
-- Import receiving and import corrections keep calling
-- execute_inventory_transaction with the signed-in user's JWT. This file
-- replaces that function only when its live argument list matches, and only
-- to replay an editor operation key. Callers that omit the key keep the
-- previous stock behavior. Sale undo keeps calling reverse_inventory_action.
--
-- One transaction. Every preflight runs before any function or schema change.
-- A failure rolls back the reversal, the indexes, and both functions together.
-- PostgreSQL allows these DDL and function replacements in a single transaction.
--
-- PostgREST connects as authenticator, verifies the bearer token, and then
-- sets the JWT claims. auth.uid() and auth.role() read those claims. Inside
-- this SECURITY DEFINER function, current_user is the owner, so it is not a
-- caller identity. A direct SQL session logs in as postgres or supabase_admin.
-- Its session_user is not authenticator, so it fails closed even if it sets a
-- JWT claim itself. The anon role fails closed. p_user_id is never
-- authorization: a signed-in caller is recorded as auth.uid(), and a
-- service-role caller may only name a user who already passes
-- is_active_business_actor for that business.
--
-- Owner, original seller, and business-user admin checks all use the action's
-- business_id. A platform admin remains global because is_active_business_actor
-- already grants that role. That path is intentional and is not expanded here.
--
-- Rollback after this transaction commits, on the same isolated database:
-- re-apply supabase/migrations/20260720082218_810179f6-6b48-4840-ba6d-4e4a08af6180.sql
-- for reverse_inventory_action, and the execute_inventory_transaction body from
-- supabase/migrations/20260810130007_e160bb9b-a1a2-4197-b824-e961f99e4d1a.sql,
-- after confirming those are still the bodies this file replaced. Then drop
-- create_product_with_opening_stock, products_opening_operation_key, and
-- inventory_actions_editor_operation_key. Drop products.opening_operation_id
-- only after confirming no retained row depends on it.

BEGIN;

DO $preflight$
DECLARE
  v_required text;
BEGIN
  IF to_regprocedure('public.reverse_inventory_action(uuid)') IS NULL THEN
    RAISE EXCEPTION 'reverse_inventory_action is missing';
  END IF;
  IF to_regprocedure('public.is_active_business_actor(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'is_active_business_actor is missing';
  END IF;
  IF to_regprocedure('public.has_role_or_higher(public.user_role,uuid)') IS NULL THEN
    RAISE EXCEPTION 'has_role_or_higher signature was not found';
  END IF;
  IF to_regprocedure('auth.role()') IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: auth.role() is missing';
  END IF;
  IF to_regprocedure('public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: execute_inventory_transaction signature does not match the prepared contract';
  END IF;

  SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO v_required
  FROM pg_attribute a
  WHERE a.attrelid = 'public.products'::regclass
    AND a.attnotnull
    AND NOT a.attisdropped
    AND a.attnum > 0
    AND a.atthasdef IS FALSE
    AND a.attname NOT IN ('name', 'business_id', 'created_by');

  IF v_required IS NOT NULL THEN
    RAISE EXCEPTION 'BLOCKED: products requires columns this opening function does not set: %', v_required;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'reference_id' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.inventory_actions'::regclass
      AND attname = 'reference_type' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'BLOCKED: inventory_actions has no reference_id and reference_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.products'::regclass
      AND attname IN ('product_category_id', 'enable_whatsapp_supplier_notification')
      AND NOT attisdropped
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'BLOCKED: product metadata columns for opening stock are missing';
  END IF;

  IF to_regclass('public.product_thresholds') IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.product_thresholds'::regclass
      AND contype IN ('p', 'u')
      AND pg_get_constraintdef(oid) ILIKE '%product_id%'
  ) THEN
    RAISE EXCEPTION 'BLOCKED: product_thresholds has no product_id uniqueness';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.reverse_inventory_action(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action RECORD;
  v_user UUID := auth.uid();
  v_is_business_admin BOOLEAN;
  v_is_owner BOOLEAN;
  v_is_platform_admin BOOLEAN;
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_reversal_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
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

  IF NOT public.is_active_business_actor(v_action.business_id, v_user) THEN
    RAISE EXCEPTION 'Not authorized to reverse this action' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = v_action.business_id AND b.owner_id = v_user
  ) INTO v_is_owner;

  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.business_id = v_action.business_id
      AND bu.user_id = v_user
      AND bu.status = 'approved'
      AND bu.role IN ('owner','admin')
  ) INTO v_is_business_admin;

  v_is_platform_admin := public.has_role_or_higher('admin'::public.user_role, v_user);

  IF v_action.user_id IS DISTINCT FROM v_user
     AND NOT v_is_owner
     AND NOT v_is_business_admin
     AND NOT COALESCE(v_is_platform_admin, false) THEN
    RAISE EXCEPTION 'Not authorized to reverse this action' USING ERRCODE = '42501';
  END IF;

  SELECT quantity INTO v_current_qty
  FROM public.products
  WHERE id = v_action.product_id AND business_id = v_action.business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_new_qty := v_current_qty - v_action.quantity_changed;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Reversal would make stock negative. Current: %, change: %',
      v_current_qty, v_action.quantity_changed;
  END IF;

  UPDATE public.products
    SET quantity = v_new_qty,
        updated_at = now()
    WHERE id = v_action.product_id AND business_id = v_action.business_id;

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

-- Import reference ids stay outside inventory_actions_editor_operation_key.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS opening_operation_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS products_opening_operation_key
  ON public.products (business_id, opening_operation_id)
  WHERE opening_operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_actions_editor_operation_key
  ON public.inventory_actions (business_id, reference_id)
  WHERE reference_type = 'editor_operation' AND reference_id IS NOT NULL;

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

  SELECT quantity, COALESCE(cost, 0)
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

  IF p_action_type = 'add' AND p_quantity_changed > 0 THEN
    IF v_new_quantity > 0 THEN
      v_new_cost := ((v_current_quantity * v_current_cost) + (p_quantity_changed * p_purchase_unit_ils)) / v_new_quantity;
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

CREATE OR REPLACE FUNCTION public.create_product_with_opening_stock(
  p_operation_id uuid,
  p_business_id uuid,
  p_name text,
  p_barcode text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_cost numeric DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_expiration_date date DEFAULT NULL,
  p_image text DEFAULT NULL,
  p_product_category_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_quantity integer DEFAULT 0,
  p_low_stock_threshold integer DEFAULT NULL,
  p_enable_whatsapp_supplier_notification boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_product_id uuid;
  v_stock jsonb;
BEGIN
  IF v_caller IS NULL OR p_operation_id IS NULL OR p_business_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_business_actor(p_business_id, v_caller) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity <> trunc(p_quantity) THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  SELECT id INTO v_product_id
  FROM public.products
  WHERE business_id = p_business_id AND opening_operation_id = p_operation_id
  FOR UPDATE;

  IF v_product_id IS NULL THEN
    INSERT INTO public.products (
      name, barcode, quantity, cost, price, location, expiration_date, image,
      business_id, created_by, supplier_id, product_category_id,
      enable_whatsapp_supplier_notification, opening_operation_id
    ) VALUES (
      btrim(p_name), NULLIF(btrim(p_barcode), ''), 0, p_cost, p_price, p_location,
      p_expiration_date, p_image, p_business_id, v_caller, p_supplier_id,
      p_product_category_id, COALESCE(p_enable_whatsapp_supplier_notification, false),
      p_operation_id
    )
    ON CONFLICT (business_id, opening_operation_id) WHERE opening_operation_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_product_id;

    IF v_product_id IS NULL THEN
      SELECT id INTO v_product_id
      FROM public.products
      WHERE business_id = p_business_id AND opening_operation_id = p_operation_id;
    END IF;
  END IF;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product was not created';
  END IF;

  IF p_quantity > 0 THEN
    IF p_cost IS NULL THEN
      v_stock := public.execute_inventory_transaction(
        p_business_id, v_caller, v_product_id, 'adjust', p_quantity,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        'הוספת מוצר חדש עם ' || p_quantity || ' יחידות ראשוניות',
        'product_opening', 'editor_operation', p_operation_id, NULL
      );
    ELSE
      v_stock := public.execute_inventory_transaction(
        p_business_id, v_caller, v_product_id, 'add', p_quantity,
        NULL, NULL, NULL, NULL, NULL, NULL, p_cost, p_cost * p_quantity, p_supplier_id,
        'הוספת מוצר חדש עם ' || p_quantity || ' יחידות ראשוניות',
        'product_opening', 'editor_operation', p_operation_id, NULL
      );
    END IF;
  END IF;

  IF p_low_stock_threshold IS NOT NULL THEN
    INSERT INTO public.product_thresholds (product_id, business_id, low_stock_threshold)
    VALUES (v_product_id, p_business_id, p_low_stock_threshold)
    ON CONFLICT (product_id) DO UPDATE
      SET low_stock_threshold = EXCLUDED.low_stock_threshold,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'product_id', v_product_id,
    'replayed', COALESCE(v_stock->>'replayed', 'false')::boolean
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_product_with_opening_stock(
  uuid, uuid, text, text, numeric, numeric, text, date, text, uuid, uuid, integer, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_opening_stock(
  uuid, uuid, text, text, numeric, numeric, text, date, text, uuid, uuid, integer, integer, boolean
) TO authenticated;

COMMIT;
