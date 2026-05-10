
-- =========================================================
-- M2: Cross-business access lockdown
-- =========================================================

-- 1. Index for fast membership lookups
CREATE INDEX IF NOT EXISTS idx_user_businesses_user_business
  ON public.user_businesses (user_id, business_id);

-- 2. Helper function (STRICT, SECURITY DEFINER, search_path locked)
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_businesses
    WHERE user_id = _user_id AND business_id = _business_id
  ) OR EXISTS (
    -- TEMPORARY fallback during architectural transition.
    -- Remove after full backfill of owners into user_businesses.
    SELECT 1 FROM public.businesses
    WHERE id = _business_id AND owner_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_business_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- 3. PRODUCTS — drop legacy/overlapping policies, install strict per-business policies
-- =========================================================
DROP POLICY IF EXISTS "Only active or valid trial users can access products" ON public.products;
DROP POLICY IF EXISTS "Users can view products in their business" ON public.products;
DROP POLICY IF EXISTS "Users can search products in their business" ON public.products;
DROP POLICY IF EXISTS "Users can manage products in their business" ON public.products;
DROP POLICY IF EXISTS "products_select_member" ON public.products;
DROP POLICY IF EXISTS "products_insert_member" ON public.products;
DROP POLICY IF EXISTS "products_update_member" ON public.products;
DROP POLICY IF EXISTS "products_delete_member" ON public.products;

CREATE POLICY "products_select_member"
ON public.products FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

CREATE POLICY "products_insert_member"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "products_update_member"
ON public.products FOR UPDATE
TO authenticated
USING (public.is_business_member(business_id))
WITH CHECK (public.is_business_member(business_id));

CREATE POLICY "products_delete_member"
ON public.products FOR DELETE
TO authenticated
USING (public.is_business_member(business_id));

-- =========================================================
-- 4. INVENTORY_ACTIONS — append-only, strict per-business
-- =========================================================
DROP POLICY IF EXISTS "Only active or valid trial users can access inventory" ON public.inventory_actions;
DROP POLICY IF EXISTS "Users can view inventory actions in their business" ON public.inventory_actions;
DROP POLICY IF EXISTS "Users can insert inventory actions in their business" ON public.inventory_actions;
DROP POLICY IF EXISTS "inventory_actions_select_member" ON public.inventory_actions;
DROP POLICY IF EXISTS "inventory_actions_insert_member" ON public.inventory_actions;

CREATE POLICY "inventory_actions_select_member"
ON public.inventory_actions FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));

CREATE POLICY "inventory_actions_insert_member"
ON public.inventory_actions FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_business_member(business_id)
);

-- (no UPDATE/DELETE policies — append-only ledger)

-- =========================================================
-- 5. RECENT_ACTIVITY — strict per-business read; system writes via SECURITY DEFINER triggers
-- =========================================================
DROP POLICY IF EXISTS "Only active or valid trial users can access activity" ON public.recent_activity;
DROP POLICY IF EXISTS "Users can view activities in their business" ON public.recent_activity;
DROP POLICY IF EXISTS "Users can view recent activity in their business" ON public.recent_activity;
DROP POLICY IF EXISTS "recent_activity_select_member" ON public.recent_activity;

CREATE POLICY "recent_activity_select_member"
ON public.recent_activity FOR SELECT
TO authenticated
USING (public.is_business_member(business_id));
