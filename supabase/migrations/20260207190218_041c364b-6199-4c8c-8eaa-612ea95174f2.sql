
-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. procurement_requests
CREATE TABLE public.procurement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  requested_quantity integer NOT NULL DEFAULT 1,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('out_of_stock', 'below_threshold', 'manual')),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting_for_quotes', 'quotes_received', 'recommended', 'waiting_for_approval', 'approved', 'ordered', 'cancelled')),
  created_by uuid,
  recommended_quote_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. supplier_quotes
CREATE TABLE public.supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_request_id uuid NOT NULL REFERENCES public.procurement_requests(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  price_per_unit numeric NOT NULL,
  available boolean NOT NULL DEFAULT true,
  delivery_time_days integer,
  currency text NOT NULL DEFAULT 'ILS',
  raw_message text,
  quote_source text NOT NULL DEFAULT 'api' CHECK (quote_source IN ('whatsapp', 'email', 'manual', 'api')),
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FK for recommended_quote_id
ALTER TABLE public.procurement_requests
  ADD CONSTRAINT procurement_requests_recommended_quote_fkey
  FOREIGN KEY (recommended_quote_id) REFERENCES public.supplier_quotes(id) ON DELETE SET NULL;

-- 3. procurement_settings
CREATE TABLE public.procurement_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  approval_required boolean NOT NULL DEFAULT true,
  max_auto_order_amount numeric,
  scoring_weights jsonb NOT NULL DEFAULT '{"price": 0.4, "delivery": 0.3, "supplier_priority": 0.2, "reliability": 0.1}'::jsonb,
  default_urgency text NOT NULL DEFAULT 'normal' CHECK (default_urgency IN ('low', 'normal', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. supplier_preferences
CREATE TABLE public.supplier_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  priority_score integer NOT NULL DEFAULT 0 CHECK (priority_score >= -100 AND priority_score <= 100),
  allow_auto_order boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.procurement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_preferences ENABLE ROW LEVEL SECURITY;

-- RLS: procurement_requests
CREATE POLICY "pr_select" ON public.procurement_requests FOR SELECT
  USING (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "pr_insert" ON public.procurement_requests FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "pr_update" ON public.procurement_requests FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "pr_delete" ON public.procurement_requests FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- RLS: supplier_quotes
CREATE POLICY "sq_select" ON public.supplier_quotes FOR SELECT
  USING (has_role_or_higher('admin'::user_role) OR procurement_request_id IN (SELECT id FROM procurement_requests WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')));

CREATE POLICY "sq_insert" ON public.supplier_quotes FOR INSERT
  WITH CHECK (procurement_request_id IN (SELECT id FROM procurement_requests WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved')));

CREATE POLICY "sq_update" ON public.supplier_quotes FOR UPDATE
  USING (procurement_request_id IN (SELECT id FROM procurement_requests WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())));

-- RLS: procurement_settings
CREATE POLICY "ps_select" ON public.procurement_settings FOR SELECT
  USING (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "ps_insert" ON public.procurement_settings FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "ps_update" ON public.procurement_settings FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- RLS: supplier_preferences
CREATE POLICY "sp_select" ON public.supplier_preferences FOR SELECT
  USING (has_role_or_higher('admin'::user_role) OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) OR business_id IN (SELECT business_id FROM business_users WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "sp_insert" ON public.supplier_preferences FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "sp_update" ON public.supplier_preferences FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "sp_delete" ON public.supplier_preferences FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Scoring Function
CREATE OR REPLACE FUNCTION public.score_procurement_quotes(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_weights jsonb;
  v_best_quote_id uuid;
  v_min_price numeric;
  v_max_price numeric;
  v_min_delivery int;
  v_max_delivery int;
BEGIN
  SELECT business_id INTO v_business_id FROM procurement_requests WHERE id = p_request_id;
  IF v_business_id IS NULL THEN RAISE EXCEPTION 'Procurement request not found'; END IF;

  SELECT COALESCE(scoring_weights, '{"price":0.4,"delivery":0.3,"supplier_priority":0.2,"reliability":0.1}'::jsonb)
  INTO v_weights FROM procurement_settings WHERE business_id = v_business_id;
  IF v_weights IS NULL THEN v_weights := '{"price":0.4,"delivery":0.3,"supplier_priority":0.2,"reliability":0.1}'::jsonb; END IF;

  SELECT MIN(price_per_unit), MAX(price_per_unit) INTO v_min_price, v_max_price
  FROM supplier_quotes WHERE procurement_request_id = p_request_id AND available = true;

  SELECT MIN(COALESCE(delivery_time_days, 999)), MAX(COALESCE(delivery_time_days, 999)) INTO v_min_delivery, v_max_delivery
  FROM supplier_quotes WHERE procurement_request_id = p_request_id AND available = true;

  UPDATE supplier_quotes sq SET score = (
    CASE WHEN v_max_price = v_min_price THEN 1.0
         ELSE (1.0 - (sq.price_per_unit - v_min_price) / NULLIF(v_max_price - v_min_price, 0)) END
    * (v_weights->>'price')::numeric
    + CASE WHEN v_max_delivery = v_min_delivery THEN 1.0
           ELSE (1.0 - (COALESCE(sq.delivery_time_days, 999) - v_min_delivery)::numeric / NULLIF((v_max_delivery - v_min_delivery)::numeric, 0)) END
    * (v_weights->>'delivery')::numeric
    + COALESCE((SELECT (sp.priority_score + 100)::numeric / 200.0 FROM supplier_preferences sp WHERE sp.business_id = v_business_id AND sp.supplier_id = sq.supplier_id), 0.5) * (v_weights->>'supplier_priority')::numeric
    + 0.5 * (v_weights->>'reliability')::numeric
  ) WHERE sq.procurement_request_id = p_request_id AND sq.available = true;

  UPDATE supplier_quotes SET score = 0 WHERE procurement_request_id = p_request_id AND available = false;

  SELECT id INTO v_best_quote_id FROM supplier_quotes
  WHERE procurement_request_id = p_request_id AND available = true ORDER BY score DESC NULLS LAST LIMIT 1;

  IF v_best_quote_id IS NOT NULL THEN
    UPDATE procurement_requests SET recommended_quote_id = v_best_quote_id, status = 'waiting_for_approval', updated_at = now()
    WHERE id = p_request_id;
  END IF;
END;
$$;

-- Auto-create procurement request trigger
CREATE OR REPLACE FUNCTION public.create_procurement_request_on_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold int;
  v_trigger_type text;
  v_requested_qty int;
  v_existing_count int;
BEGIN
  IF NEW.quantity >= OLD.quantity THEN RETURN NEW; END IF;

  SELECT low_stock_threshold INTO v_threshold FROM product_thresholds WHERE product_id = NEW.id AND business_id = NEW.business_id;
  v_threshold := COALESCE(v_threshold, 5);

  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN v_trigger_type := 'out_of_stock';
  ELSIF NEW.quantity <= v_threshold AND OLD.quantity > v_threshold THEN v_trigger_type := 'below_threshold';
  ELSE RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_existing_count FROM procurement_requests
  WHERE product_id = NEW.id AND business_id = NEW.business_id AND status NOT IN ('ordered', 'cancelled');
  IF v_existing_count > 0 THEN RETURN NEW; END IF;

  v_requested_qty := GREATEST(v_threshold * 2, 1);

  INSERT INTO procurement_requests (business_id, product_id, requested_quantity, trigger_type, urgency, status, created_by)
  VALUES (NEW.business_id, NEW.id, v_requested_qty, v_trigger_type,
    CASE WHEN NEW.quantity = 0 THEN 'high' ELSE 'normal' END, 'waiting_for_quotes', NULL);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_procurement_on_stock_change
  AFTER UPDATE OF quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.create_procurement_request_on_stock_change();

-- Updated_at triggers
CREATE TRIGGER update_procurement_requests_updated_at BEFORE UPDATE ON public.procurement_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_procurement_settings_updated_at BEFORE UPDATE ON public.procurement_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplier_preferences_updated_at BEFORE UPDATE ON public.supplier_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_procurement_requests_business ON public.procurement_requests(business_id);
CREATE INDEX idx_procurement_requests_product ON public.procurement_requests(product_id);
CREATE INDEX idx_procurement_requests_status ON public.procurement_requests(status);
CREATE INDEX idx_supplier_quotes_request ON public.supplier_quotes(procurement_request_id);
CREATE INDEX idx_supplier_preferences_business ON public.supplier_preferences(business_id);
