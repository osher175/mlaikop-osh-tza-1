-- =====================================================================
-- Import Module Phase 0.5 — Security preconditions (P0 fixes)
-- 1) execute_inventory_transaction: internal tenant authorization
-- 2) brands: remove world-writable access, add narrow controlled writer
-- Additive / non-destructive: no tables dropped, no data transformed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: canonical "active member of business" check used by inventory.
-- Mirrors the membership model already used by RLS policies
-- (businesses.owner_id, business_users approved, user_businesses),
-- plus the existing intentional platform-admin path (user_roles.admin).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_business_actor(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _business_id IS NOT NULL AND _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.businesses b
            WHERE b.id = _business_id AND b.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.business_users bu
               WHERE bu.business_id = _business_id AND bu.user_id = _user_id
                 AND bu.status = 'approved')
    OR EXISTS (SELECT 1 FROM public.user_businesses ub
               WHERE ub.business_id = _business_id AND ub.user_id = _user_id)
    -- existing, intentionally supported platform-admin path
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = _user_id AND ur.role = 'admin'::user_role)
  );
$function$;

REVOKE ALL ON FUNCTION public.is_active_business_actor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_business_actor(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1) execute_inventory_transaction — unchanged inventory semantics
--    (row lock, atomic quantity update, rolling-average cost, single
--     ledger insert, identical return shape) + fail-closed authorization.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_inventory_transaction(
  p_business_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_action_type text,
  p_quantity_changed integer,
  p_sale_total_ils numeric DEFAULT NULL::numeric,
  p_sale_unit_ils numeric DEFAULT NULL::numeric,
  p_list_unit_ils numeric DEFAULT NULL::numeric,
  p_discount_ils numeric DEFAULT NULL::numeric,
  p_discount_percent numeric DEFAULT NULL::numeric,
  p_cost_snapshot_ils numeric DEFAULT NULL::numeric,
  p_purchase_unit_ils numeric DEFAULT NULL::numeric,
  p_purchase_total_ils numeric DEFAULT NULL::numeric,
  p_supplier_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
  v_actor UUID;
  v_current_quantity INTEGER;
  v_current_cost NUMERIC;
  v_new_quantity INTEGER;
  v_new_cost NUMERIC;
  v_action_id UUID;
  v_result JSONB;
BEGIN
  -- ---- SECURITY: fail-closed tenant authorization -------------------
  -- Trusted backend (service_role / cron / edge functions) may act on
  -- behalf of a user; everything else must be an authenticated member.
  IF v_caller IS NULL THEN
    IF current_setting('role', true) = 'service_role'
       OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
      v_actor := p_user_id;                     -- backend-attributed action
    ELSE
      RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_actor := v_caller;                        -- never trust p_user_id
  END IF;

  IF v_actor IS NULL OR p_business_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;

  IF v_caller IS NOT NULL
     AND NOT public.is_active_business_actor(p_business_id, v_caller) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;
  -- -------------------------------------------------------------------

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

  v_new_quantity := v_current_quantity + p_quantity_changed;

  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested change: %', v_current_quantity, p_quantity_changed;
  END IF;

  -- Rolling average cost for purchases
  IF p_action_type = 'add' AND p_quantity_changed > 0 THEN
    IF v_new_quantity > 0 THEN
      v_new_cost := ((v_current_quantity * v_current_cost) + (p_quantity_changed * p_purchase_unit_ils)) / v_new_quantity;
    ELSE
      v_new_cost := p_purchase_unit_ils;
    END IF;
  ELSE
    v_new_cost := v_current_cost;
  END IF;

  -- STEP 1: ledger entry (exactly once)
  INSERT INTO public.inventory_actions (
    id, business_id, user_id, product_id, action_type, quantity_changed, currency,
    sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent, cost_snapshot_ils,
    purchase_unit_ils, purchase_total_ils, supplier_id, notes, timestamp
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
    p_notes, now()
  )
  RETURNING id INTO v_action_id;

  -- STEP 2: apply stock/cost
  UPDATE public.products
  SET quantity = v_new_quantity,
      cost = v_new_cost,
      updated_at = now()
  WHERE id = p_product_id AND business_id = p_business_id;

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
    RAISE;
END;
$function$;

COMMENT ON FUNCTION public.execute_inventory_transaction IS
  'Atomic inventory transaction (lock + ledger + stock/cost update). SECURITY DEFINER with internal fail-closed tenant authorization: caller must be an active member of p_business_id (owner / approved employee / user_businesses) or platform admin; trusted service_role backend may attribute the action to p_user_id.';

-- Ensure only authenticated + backend can execute (before: EXECUTE also to anon/PUBLIC)
REVOKE ALL ON FUNCTION public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) brands — global catalog: readable by authenticated, not writable
-- Before: policies allowed ANY authenticated user to INSERT/UPDATE/DELETE
--         any global brand; table grants gave anon full DML too.
-- After : SELECT for authenticated only; no write policies; writes only
--         via service_role or the controlled RPC below.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can update brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can delete brands" ON public.brands;
DROP POLICY IF EXISTS "Authenticated users can select brands" ON public.brands;

CREATE POLICY "Authenticated users can read brands"
  ON public.brands FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON public.brands FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.brands FROM authenticated;
GRANT SELECT ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

-- Narrow controlled writer: lets an authorized business member register a
-- previously unknown brand name. Insert-only, validated, case-insensitive
-- dedupe. No update/delete path is exposed to tenants.
CREATE OR REPLACE FUNCTION public.create_brand_if_missing(p_business_id uuid, p_name text, p_tier text DEFAULT 'standard')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_business_actor(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Invalid brand name';
  END IF;

  SELECT id INTO v_id FROM public.brands WHERE lower(name) = lower(v_name) LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.brands (name, tier)
  VALUES (v_name, COALESCE(NULLIF(btrim(p_tier), ''), 'standard'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_brand_if_missing(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_brand_if_missing(uuid, text, text) TO authenticated, service_role;