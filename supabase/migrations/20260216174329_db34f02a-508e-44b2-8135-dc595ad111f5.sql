
-- ============================================================
-- Part 1.1: Create procurement_supplier_pairs table
-- ============================================================
CREATE TABLE public.procurement_supplier_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category', 'product')),
  category_id uuid NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_a_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_b_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  strategy text NOT NULL DEFAULT 'balanced' CHECK (strategy IN ('cheapest', 'quality', 'balanced')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- scope='category' => category_id NOT NULL, product_id IS NULL
  CONSTRAINT chk_scope_category CHECK (
    scope <> 'category' OR (category_id IS NOT NULL AND product_id IS NULL)
  ),
  -- scope='product' => product_id NOT NULL
  CONSTRAINT chk_scope_product CHECK (
    scope <> 'product' OR product_id IS NOT NULL
  ),
  -- suppliers must differ
  CONSTRAINT chk_different_suppliers CHECK (supplier_a_id <> supplier_b_id)
);

-- Indexes
CREATE INDEX idx_pairs_business_scope ON public.procurement_supplier_pairs (business_id, scope, is_active);
CREATE UNIQUE INDEX idx_pairs_product_unique ON public.procurement_supplier_pairs (business_id, product_id) WHERE scope = 'product' AND is_active = true;
CREATE UNIQUE INDEX idx_pairs_category_unique ON public.procurement_supplier_pairs (business_id, category_id) WHERE scope = 'category' AND is_active = true;

-- RLS
ALTER TABLE public.procurement_supplier_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_select" ON public.procurement_supplier_pairs FOR SELECT
USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
);

CREATE POLICY "psp_insert" ON public.procurement_supplier_pairs FOR INSERT
WITH CHECK (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
);

CREATE POLICY "psp_update" ON public.procurement_supplier_pairs FOR UPDATE
USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')
);

CREATE POLICY "psp_delete" ON public.procurement_supplier_pairs FOR DELETE
USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

-- ============================================================
-- Part 1.2: Extend procurement_requests
-- ============================================================
ALTER TABLE public.procurement_requests
  ADD COLUMN supplier_a_id uuid NULL REFERENCES public.suppliers(id),
  ADD COLUMN supplier_b_id uuid NULL REFERENCES public.suppliers(id),
  ADD COLUMN pair_source text NOT NULL DEFAULT 'none' CHECK (pair_source IN ('product', 'category', 'none')),
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX idx_proc_req_approval ON public.procurement_requests (business_id, approval_status, status);
