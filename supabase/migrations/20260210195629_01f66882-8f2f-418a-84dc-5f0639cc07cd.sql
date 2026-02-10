
-- ============================================================
-- Migration: Smart Procurement Agent - All tables
-- ============================================================

-- 1) brands
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  tier text NOT NULL CHECK (tier IN ('A','B','C')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select brands"
  ON public.brands FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert brands"
  ON public.brands FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update brands"
  ON public.brands FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete brands"
  ON public.brands FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 2) supplier_brands
CREATE TABLE public.supplier_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, supplier_id, brand_id)
);

ALTER TABLE public.supplier_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sb_select" ON public.supplier_brands FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "sb_insert" ON public.supplier_brands FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "sb_update" ON public.supplier_brands FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "sb_delete" ON public.supplier_brands FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- 3) category_supplier_preferences
CREATE TABLE public.category_supplier_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, category_id, supplier_id)
);

ALTER TABLE public.category_supplier_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csp_select" ON public.category_supplier_preferences FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "csp_insert" ON public.category_supplier_preferences FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "csp_update" ON public.category_supplier_preferences FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "csp_delete" ON public.category_supplier_preferences FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- 4) Add columns to products
ALTER TABLE public.products
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 5) procurement_conversations
CREATE TABLE public.procurement_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  procurement_request_id uuid NOT NULL REFERENCES public.procurement_requests(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  mode text NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot','manual')),
  last_outgoing_at timestamptz,
  last_incoming_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, product_id, supplier_id, status)
);

ALTER TABLE public.procurement_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_select" ON public.procurement_conversations FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "pc_insert" ON public.procurement_conversations FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "pc_update" ON public.procurement_conversations FOR UPDATE
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "pc_delete" ON public.procurement_conversations FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- 6) procurement_messages
CREATE TABLE public.procurement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.procurement_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('outgoing','incoming')),
  message_text text NOT NULL,
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.procurement_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select" ON public.procurement_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM procurement_conversations
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
         OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );

CREATE POLICY "pm_insert" ON public.procurement_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM procurement_conversations
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
         OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
    )
  );

CREATE POLICY "pm_update" ON public.procurement_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM procurement_conversations
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );
