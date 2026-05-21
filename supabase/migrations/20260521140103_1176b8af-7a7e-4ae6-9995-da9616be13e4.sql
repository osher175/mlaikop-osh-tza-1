
-- Helper: re-create write policies with can_business_write gate.
-- Reads stay unchanged.

-- PRODUCTS
DROP POLICY IF EXISTS products_insert_member ON public.products;
DROP POLICY IF EXISTS products_update_member ON public.products;
DROP POLICY IF EXISTS products_delete_member ON public.products;
CREATE POLICY products_insert_member ON public.products FOR INSERT TO authenticated
  WITH CHECK (is_business_member(business_id) AND can_business_write(business_id));
CREATE POLICY products_update_member ON public.products FOR UPDATE TO authenticated
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND can_business_write(business_id));
CREATE POLICY products_delete_member ON public.products FOR DELETE TO authenticated
  USING (is_business_member(business_id) AND can_business_write(business_id));

-- INVENTORY_ACTIONS (insert only is exposed; updates/deletes already blocked)
DROP POLICY IF EXISTS inventory_actions_insert_member ON public.inventory_actions;
CREATE POLICY inventory_actions_insert_member ON public.inventory_actions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_business_member(business_id) AND can_business_write(business_id));

-- SUPPLIERS
DROP POLICY IF EXISTS suppliers_insert_owner_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_owner_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_owner_admin ON public.suppliers;
CREATE POLICY suppliers_insert_owner_admin ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (is_business_member(business_id) AND can_business_write(business_id));
CREATE POLICY suppliers_update_owner_admin ON public.suppliers FOR UPDATE TO authenticated
  USING (is_business_member(business_id))
  WITH CHECK (is_business_member(business_id) AND can_business_write(business_id));
CREATE POLICY suppliers_delete_owner_admin ON public.suppliers FOR DELETE TO authenticated
  USING (is_business_member(business_id) AND can_business_write(business_id));

-- NOTIFICATIONS (user-side update)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid())
    OR has_role_or_higher('admin'::user_role)
    OR (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    can_business_write(business_id) AND (
      (user_id = auth.uid())
      OR has_role_or_higher('admin'::user_role)
      OR (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    )
  );

-- NOTIFICATION_SETTINGS
DROP POLICY IF EXISTS ns_insert_policy ON public.notification_settings;
DROP POLICY IF EXISTS ns_update_policy ON public.notification_settings;
DROP POLICY IF EXISTS ns_delete_policy ON public.notification_settings;
CREATE POLICY ns_insert_policy ON public.notification_settings FOR INSERT TO authenticated
  WITH CHECK (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );
CREATE POLICY ns_update_policy ON public.notification_settings FOR UPDATE TO authenticated
  USING (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );
CREATE POLICY ns_delete_policy ON public.notification_settings FOR DELETE TO authenticated
  USING (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );

-- PRODUCT_THRESHOLDS
DROP POLICY IF EXISTS pt_insert_policy ON public.product_thresholds;
DROP POLICY IF EXISTS pt_update_policy ON public.product_thresholds;
DROP POLICY IF EXISTS pt_delete_policy ON public.product_thresholds;
CREATE POLICY pt_insert_policy ON public.product_thresholds FOR INSERT TO authenticated
  WITH CHECK (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );
CREATE POLICY pt_update_policy ON public.product_thresholds FOR UPDATE TO authenticated
  USING (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );
CREATE POLICY pt_delete_policy ON public.product_thresholds FOR DELETE TO authenticated
  USING (
    (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
    AND can_business_write(business_id)
  );

-- CATEGORIES (rewrite the single ALL policy as 4 separate)
DROP POLICY IF EXISTS "Users can manage categories in their business" ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT
  USING (
    business_id IS NULL
    OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
  );
CREATE POLICY categories_insert ON public.categories FOR INSERT
  WITH CHECK (
    (business_id IS NULL OR can_business_write(business_id))
    AND (
      business_id IS NULL
      OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    )
  );
CREATE POLICY categories_update ON public.categories FOR UPDATE
  USING (
    business_id IS NULL
    OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
  )
  WITH CHECK (
    (business_id IS NULL OR can_business_write(business_id))
    AND (
      business_id IS NULL
      OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    )
  );
CREATE POLICY categories_delete ON public.categories FOR DELETE
  USING (
    (business_id IS NULL OR can_business_write(business_id))
    AND (
      business_id IS NULL
      OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM user_businesses WHERE user_id = auth.uid())
    )
  );

-- AUTOMATION_OUTBOX (owner update path; service role insert untouched)
DROP POLICY IF EXISTS "Business owners can update outbox events" ON public.automation_outbox;
CREATE POLICY "Business owners can update outbox events" ON public.automation_outbox FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    AND can_business_write(business_id)
  );

-- PROCUREMENT_REQUESTS
DROP POLICY IF EXISTS pr_insert ON public.procurement_requests;
DROP POLICY IF EXISTS pr_update ON public.procurement_requests;
DROP POLICY IF EXISTS pr_delete ON public.procurement_requests;
CREATE POLICY pr_insert ON public.procurement_requests FOR INSERT
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY pr_update ON public.procurement_requests FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  )
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY pr_delete ON public.procurement_requests FOR DELETE
  USING (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- PROCUREMENT_CONVERSATIONS
DROP POLICY IF EXISTS pc_insert ON public.procurement_conversations;
DROP POLICY IF EXISTS pc_update ON public.procurement_conversations;
DROP POLICY IF EXISTS pc_delete ON public.procurement_conversations;
CREATE POLICY pc_insert ON public.procurement_conversations FOR INSERT
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY pc_update ON public.procurement_conversations FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  )
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY pc_delete ON public.procurement_conversations FOR DELETE
  USING (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- PROCUREMENT_SETTINGS
DROP POLICY IF EXISTS ps_insert ON public.procurement_settings;
DROP POLICY IF EXISTS ps_update ON public.procurement_settings;
CREATE POLICY ps_insert ON public.procurement_settings FOR INSERT
  WITH CHECK (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
CREATE POLICY ps_update ON public.procurement_settings FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- PROCUREMENT_SUPPLIER_PAIRS
DROP POLICY IF EXISTS psp_insert ON public.procurement_supplier_pairs;
DROP POLICY IF EXISTS psp_update ON public.procurement_supplier_pairs;
DROP POLICY IF EXISTS psp_delete ON public.procurement_supplier_pairs;
CREATE POLICY psp_insert ON public.procurement_supplier_pairs FOR INSERT
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY psp_update ON public.procurement_supplier_pairs FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  )
  WITH CHECK (
    can_business_write(business_id) AND (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );
CREATE POLICY psp_delete ON public.procurement_supplier_pairs FOR DELETE
  USING (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- CATEGORY_SUPPLIER_PREFERENCES
DROP POLICY IF EXISTS csp_insert ON public.category_supplier_preferences;
DROP POLICY IF EXISTS csp_update ON public.category_supplier_preferences;
DROP POLICY IF EXISTS csp_delete ON public.category_supplier_preferences;
CREATE POLICY csp_insert ON public.category_supplier_preferences FOR INSERT
  WITH CHECK (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
CREATE POLICY csp_update ON public.category_supplier_preferences FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
CREATE POLICY csp_delete ON public.category_supplier_preferences FOR DELETE
  USING (
    can_business_write(business_id)
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
