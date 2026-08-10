-- =====================================================================
-- Import Module — Phase 1: Foundation (additive, tenant-scoped)
-- No stock mutation. No procurement domain changes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Canonical authorization helper for the Import domain.
-- Owner / approved business admin / platform admin only.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_business_imports(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _business_id IS NOT NULL AND _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.businesses b
            WHERE b.id = _business_id AND b.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.business_users bu
               WHERE bu.business_id = _business_id AND bu.user_id = _user_id
                 AND bu.status = 'approved' AND bu.role IN ('OWNER', 'admin'))
    OR EXISTS (SELECT 1 FROM public.user_businesses ub
               WHERE ub.business_id = _business_id AND ub.user_id = _user_id
                 AND ub.role IN ('OWNER', 'admin'))
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = _user_id AND ur.role = 'admin'::user_role)
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_business_imports(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business_imports(uuid, uuid) TO authenticated, service_role;

-- =====================================================================
-- 1) import_orders
-- =====================================================================
CREATE TABLE public.import_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  import_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_type text NOT NULL DEFAULT 'direct_import'
    CHECK (purchase_type IN ('direct_import', 'parallel_import')),
  supplier_country text,
  currency_code text NOT NULL DEFAULT 'ILS'
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  working_exchange_rate_to_ils numeric(14,6)
    CHECK (working_exchange_rate_to_ils IS NULL OR working_exchange_rate_to_ils > 0),
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date,
  estimated_arrival_date date,
  status text NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('ordered','preparing','shipped','in_transit','arrived_israel',
                      'customs_clearance','receiving','received_pending_costs',
                      'completed','cancelled')),
  supplier_order_reference text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_orders TO authenticated;
GRANT ALL ON public.import_orders TO service_role;
ALTER TABLE public.import_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_orders_manage" ON public.import_orders
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id))
  WITH CHECK (public.can_manage_business_imports(business_id));

CREATE UNIQUE INDEX idx_import_orders_number_per_business
  ON public.import_orders (business_id, import_number);
CREATE INDEX idx_import_orders_business_status ON public.import_orders (business_id, status);
CREATE INDEX idx_import_orders_business_created ON public.import_orders (business_id, created_at DESC);
CREATE INDEX idx_import_orders_eta ON public.import_orders (business_id, estimated_arrival_date);
CREATE INDEX idx_import_orders_supplier ON public.import_orders (supplier_id);

-- =====================================================================
-- 2) import_order_items
-- =====================================================================
CREATE TABLE public.import_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  manufacturer_name text,
  supplier_sku text,
  product_description text NOT NULL,
  ordered_quantity integer NOT NULL CHECK (ordered_quantity > 0),
  supplier_unit_cost numeric(14,4) NOT NULL DEFAULT 0 CHECK (supplier_unit_cost >= 0),
  currency_code text NOT NULL DEFAULT 'ILS' CHECK (currency_code ~ '^[A-Z]{3}$'),
  planned_sale_price_ils numeric(14,2) CHECK (planned_sale_price_ils IS NULL OR planned_sale_price_ils >= 0),
  expected_unit_cost_ils numeric(14,4) CHECK (expected_unit_cost_ils IS NULL OR expected_unit_cost_ils >= 0),
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  item_status text NOT NULL DEFAULT 'pending'
    CHECK (item_status IN ('pending','partially_received','received','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_order_items TO authenticated;
GRANT ALL ON public.import_order_items TO service_role;
ALTER TABLE public.import_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_order_items_manage" ON public.import_order_items
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id))
  WITH CHECK (public.can_manage_business_imports(business_id));

CREATE INDEX idx_import_items_order ON public.import_order_items (import_order_id);
CREATE INDEX idx_import_items_business ON public.import_order_items (business_id);
CREATE INDEX idx_import_items_product ON public.import_order_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_import_items_brand ON public.import_order_items (brand_id);

-- =====================================================================
-- 3) import_costs
-- =====================================================================
CREATE TABLE public.import_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'international_freight','insurance','customs','taxes_fees','customs_broker',
    'port','storage','local_transport','standards_testing','bank_fx_fees','other')),
  description text,
  amount numeric(14,4) NOT NULL CHECK (amount >= 0),
  currency_code text NOT NULL DEFAULT 'ILS' CHECK (currency_code ~ '^[A-Z]{3}$'),
  exchange_rate_to_ils numeric(14,6) CHECK (exchange_rate_to_ils IS NULL OR exchange_rate_to_ils > 0),
  amount_ils numeric(14,2) GENERATED ALWAYS AS
    (round(amount * COALESCE(exchange_rate_to_ils, 1), 2)) STORED,
  cost_state text NOT NULL DEFAULT 'estimated' CHECK (cost_state IN ('estimated','final')),
  service_provider_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_reference text,
  cost_date date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_costs TO authenticated;
GRANT ALL ON public.import_costs TO service_role;
ALTER TABLE public.import_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_costs_manage" ON public.import_costs
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id))
  WITH CHECK (public.can_manage_business_imports(business_id));

CREATE INDEX idx_import_costs_order ON public.import_costs (import_order_id);
CREATE INDEX idx_import_costs_business ON public.import_costs (business_id);

-- =====================================================================
-- 4) import_payments
-- =====================================================================
CREATE TABLE public.import_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  import_cost_id uuid REFERENCES public.import_costs(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payee_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  payment_type text NOT NULL CHECK (payment_type IN (
    'deposit','balance','partial','supplier_payment','freight_payment',
    'customs_payment','broker_payment','other')),
  amount numeric(14,4) NOT NULL CHECK (amount >= 0),
  currency_code text NOT NULL DEFAULT 'ILS' CHECK (currency_code ~ '^[A-Z]{3}$'),
  exchange_rate_to_ils numeric(14,6) CHECK (exchange_rate_to_ils IS NULL OR exchange_rate_to_ils > 0),
  amount_ils numeric(14,2) GENERATED ALWAYS AS
    (round(amount * COALESCE(exchange_rate_to_ils, 1), 2)) STORED,
  payment_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jerusalem')::date,
  payment_status text NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('planned','pending','paid','cancelled')),
  reference text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_payments TO authenticated;
GRANT ALL ON public.import_payments TO service_role;
ALTER TABLE public.import_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_payments_manage" ON public.import_payments
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id))
  WITH CHECK (public.can_manage_business_imports(business_id));

CREATE INDEX idx_import_payments_order ON public.import_payments (import_order_id);
CREATE INDEX idx_import_payments_business ON public.import_payments (business_id);

-- =====================================================================
-- 5) import_documents
-- =====================================================================
CREATE TABLE public.import_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'commercial_invoice','packing_list','bill_of_lading','shipping_invoice',
    'customs_document','broker_invoice','local_transport_invoice','other')),
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_documents TO authenticated;
GRANT ALL ON public.import_documents TO service_role;
ALTER TABLE public.import_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_documents_manage" ON public.import_documents
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id))
  WITH CHECK (public.can_manage_business_imports(business_id));

CREATE INDEX idx_import_documents_order ON public.import_documents (import_order_id);
CREATE INDEX idx_import_documents_business ON public.import_documents (business_id);

-- =====================================================================
-- 6) import_events (append-only audit trail)
-- =====================================================================
CREATE TABLE public.import_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_order_id uuid NOT NULL REFERENCES public.import_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'order_created','status_changed','eta_changed','cost_added','cost_updated',
    'payment_added','document_uploaded','receiving_started','receipt_confirmed',
    'receipt_corrected','order_closed','order_reopened')),
  actor_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.import_events TO authenticated;
GRANT ALL ON public.import_events TO service_role;
ALTER TABLE public.import_events ENABLE ROW LEVEL SECURITY;
-- Read-only for authorized managers; writes happen exclusively through the
-- SECURITY DEFINER trigger below (no INSERT/UPDATE/DELETE policy on purpose).
CREATE POLICY "import_events_select" ON public.import_events
  FOR SELECT TO authenticated
  USING (public.can_manage_business_imports(business_id));

CREATE INDEX idx_import_events_order ON public.import_events (import_order_id, created_at DESC);
CREATE INDEX idx_import_events_business ON public.import_events (business_id, created_at DESC);

-- =====================================================================
-- 7) Import PIN (step-up only — never a grant mechanism)
-- =====================================================================
CREATE TABLE public.import_pin_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_success_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.import_pin_settings TO service_role;
ALTER TABLE public.import_pin_settings ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated`: the hash is only ever touched by the
-- SECURITY DEFINER RPCs below.

CREATE TABLE public.import_pin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.import_pin_sessions TO service_role;
ALTER TABLE public.import_pin_sessions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_import_pin_sessions_token ON public.import_pin_sessions (token);
CREATE INDEX idx_import_pin_sessions_lookup ON public.import_pin_sessions (business_id, user_id);

-- =====================================================================
-- Triggers: updated_at, tenant consistency, numbering, audit events
-- =====================================================================
CREATE TRIGGER trg_import_orders_updated_at BEFORE UPDATE ON public.import_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_items_updated_at BEFORE UPDATE ON public.import_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_costs_updated_at BEFORE UPDATE ON public.import_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_pin_settings_updated_at BEFORE UPDATE ON public.import_pin_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Child rows must belong to the same tenant as their parent order.
CREATE OR REPLACE FUNCTION public.import_enforce_order_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_bid uuid;
BEGIN
  SELECT business_id INTO v_bid FROM public.import_orders WHERE id = NEW.import_order_id;
  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'Import order not found';
  END IF;
  IF NEW.business_id IS DISTINCT FROM v_bid THEN
    RAISE EXCEPTION 'business_id does not match the parent import order';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_import_items_tenant BEFORE INSERT OR UPDATE ON public.import_order_items
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();
CREATE TRIGGER trg_import_costs_tenant BEFORE INSERT OR UPDATE ON public.import_costs
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();
CREATE TRIGGER trg_import_payments_tenant BEFORE INSERT OR UPDATE ON public.import_payments
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();
CREATE TRIGGER trg_import_documents_tenant BEFORE INSERT OR UPDATE ON public.import_documents
  FOR EACH ROW EXECUTE FUNCTION public.import_enforce_order_tenant();

-- Per-business, per-year human readable number: IMP-2026-0001
CREATE OR REPLACE FUNCTION public.import_assign_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year text;
  v_next integer;
BEGIN
  IF NEW.import_number IS NOT NULL AND length(trim(NEW.import_number)) > 0 THEN
    RETURN NEW;
  END IF;
  v_year := to_char(COALESCE(NEW.order_date, (now() AT TIME ZONE 'Asia/Jerusalem')::date), 'YYYY');
  SELECT COALESCE(MAX((regexp_replace(import_number, '^IMP-\d{4}-', ''))::integer), 0) + 1
    INTO v_next
  FROM public.import_orders
  WHERE business_id = NEW.business_id
    AND import_number ~ ('^IMP-' || v_year || '-\d+$');
  NEW.import_number := 'IMP-' || v_year || '-' || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_import_orders_number BEFORE INSERT ON public.import_orders
  FOR EACH ROW EXECUTE FUNCTION public.import_assign_number();

-- Audit trail writer (SECURITY DEFINER: import_events has no write policy)
CREATE OR REPLACE FUNCTION public.import_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_TABLE_NAME = 'import_orders' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (NEW.id, NEW.business_id, 'order_created', auth.uid(),
              jsonb_build_object('import_number', NEW.import_number, 'status', NEW.status));
    ELSE
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
        VALUES (NEW.id, NEW.business_id, 'status_changed', auth.uid(),
                jsonb_build_object('from', OLD.status, 'to', NEW.status));
      END IF;
      IF NEW.estimated_arrival_date IS DISTINCT FROM OLD.estimated_arrival_date THEN
        INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
        VALUES (NEW.id, NEW.business_id, 'eta_changed', auth.uid(),
                jsonb_build_object('from', OLD.estimated_arrival_date, 'to', NEW.estimated_arrival_date));
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'import_costs' THEN
    INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
    VALUES (NEW.import_order_id, NEW.business_id,
            CASE WHEN TG_OP = 'INSERT' THEN 'cost_added' ELSE 'cost_updated' END, auth.uid(),
            jsonb_build_object('category', NEW.category, 'amount_ils', NEW.amount_ils, 'cost_state', NEW.cost_state));
  ELSIF TG_TABLE_NAME = 'import_payments' THEN
    INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
    VALUES (NEW.import_order_id, NEW.business_id, 'payment_added', auth.uid(),
            jsonb_build_object('payment_type', NEW.payment_type, 'amount_ils', NEW.amount_ils, 'payment_status', NEW.payment_status));
  ELSIF TG_TABLE_NAME = 'import_documents' THEN
    INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
    VALUES (NEW.import_order_id, NEW.business_id, 'document_uploaded', auth.uid(),
            jsonb_build_object('document_type', NEW.document_type, 'filename', NEW.original_filename));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_import_orders_events AFTER INSERT OR UPDATE ON public.import_orders
  FOR EACH ROW EXECUTE FUNCTION public.import_log_event();
CREATE TRIGGER trg_import_costs_events AFTER INSERT OR UPDATE ON public.import_costs
  FOR EACH ROW EXECUTE FUNCTION public.import_log_event();
CREATE TRIGGER trg_import_payments_events AFTER INSERT ON public.import_payments
  FOR EACH ROW EXECUTE FUNCTION public.import_log_event();
CREATE TRIGGER trg_import_documents_events AFTER INSERT ON public.import_documents
  FOR EACH ROW EXECUTE FUNCTION public.import_log_event();

-- =====================================================================
-- PIN RPCs (fail-closed; require import authorization first)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.import_pin_status(p_business_id uuid)
RETURNS TABLE (is_configured boolean, is_locked boolean, locked_until timestamptz, failed_attempts integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT true,
         (s.locked_until IS NOT NULL AND s.locked_until > now()),
         s.locked_until,
         s.failed_attempts
  FROM public.import_pin_settings s
  WHERE s.business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::timestamptz, 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_pin_set(p_business_id uuid, p_new_pin text, p_current_pin text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE v_hash text;
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF p_new_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  SELECT pin_hash INTO v_hash FROM public.import_pin_settings WHERE business_id = p_business_id;

  IF v_hash IS NOT NULL THEN
    IF p_current_pin IS NULL OR extensions.crypt(p_current_pin, v_hash) <> v_hash THEN
      RAISE EXCEPTION 'Current PIN is incorrect' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.import_pin_settings (business_id, pin_hash, updated_by, failed_attempts, locked_until)
  VALUES (p_business_id, extensions.crypt(p_new_pin, extensions.gen_salt('bf')), auth.uid(), 0, NULL)
  ON CONFLICT (business_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_by = EXCLUDED.updated_by,
        failed_attempts = 0, locked_until = NULL, updated_at = now();

  DELETE FROM public.import_pin_sessions WHERE business_id = p_business_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_pin_verify(p_business_id uuid, p_pin text)
RETURNS TABLE (success boolean, token uuid, expires_at timestamptz, locked_until timestamptz, attempts_left integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_row public.import_pin_settings%ROWTYPE;
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.import_pin_settings WHERE business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No PIN configured for this business';
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, v_row.locked_until, 0;
    RETURN;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' OR extensions.crypt(p_pin, v_row.pin_hash) <> v_row.pin_hash THEN
    UPDATE public.import_pin_settings
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
          updated_at = now()
    WHERE business_id = p_business_id
    RETURNING * INTO v_row;
    RETURN QUERY SELECT false, NULL::uuid, NULL::timestamptz, v_row.locked_until,
                        GREATEST(0, 5 - v_row.failed_attempts);
    RETURN;
  END IF;

  UPDATE public.import_pin_settings
    SET failed_attempts = 0, locked_until = NULL, last_success_at = now(), updated_at = now()
  WHERE business_id = p_business_id;

  DELETE FROM public.import_pin_sessions
   WHERE (business_id = p_business_id AND user_id = auth.uid()) OR expires_at < now();

  INSERT INTO public.import_pin_sessions (business_id, user_id)
  VALUES (p_business_id, auth.uid())
  RETURNING import_pin_sessions.token, import_pin_sessions.expires_at INTO v_token, v_expires;

  RETURN QUERY SELECT true, v_token, v_expires, NULL::timestamptz, 5;
END;
$$;

-- Validates an unlock session and slides the 30-minute inactivity window.
CREATE OR REPLACE FUNCTION public.import_pin_session_touch(p_business_id uuid, p_token uuid)
RETURNS TABLE (valid boolean, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_expires timestamptz;
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.import_pin_sessions s
     SET last_activity_at = now(), expires_at = now() + interval '30 minutes'
   WHERE s.business_id = p_business_id
     AND s.user_id = auth.uid()
     AND s.token = p_token
     AND s.expires_at > now()
  RETURNING s.expires_at INTO v_expires;

  IF v_expires IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
  ELSE
    RETURN QUERY SELECT true, v_expires;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_pin_lock(p_business_id uuid, p_token uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.import_pin_sessions
   WHERE business_id = p_business_id AND user_id = auth.uid()
     AND (p_token IS NULL OR token = p_token);
  RETURN true;
END;
$$;

-- =====================================================================
-- Read models: import centre page, landed cost, quantity in transit
-- =====================================================================
CREATE OR REPLACE FUNCTION public.import_orders_page(
  p_business_id uuid,
  p_scope text DEFAULT 'active',
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  import_number text,
  supplier_id uuid,
  supplier_name text,
  purchase_type text,
  status text,
  currency_code text,
  order_date date,
  estimated_arrival_date date,
  ordered_units bigint,
  received_units bigint,
  goods_cost_ils numeric,
  import_costs_ils numeric,
  estimated_total_cost_ils numeric,
  paid_ils numeric,
  remaining_payment_ils numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT o.*, s.name AS supplier_name
    FROM public.import_orders o
    LEFT JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.business_id = p_business_id
      AND (p_status IS NULL OR o.status = p_status)
      AND (
        p_scope = 'all'
        OR (p_scope = 'active' AND o.status NOT IN ('completed', 'cancelled'))
        OR (p_scope = 'completed' AND o.status IN ('completed', 'cancelled'))
      )
      AND (
        v_search IS NULL
        OR o.import_number ILIKE '%' || v_search || '%'
        OR COALESCE(s.name, '') ILIKE '%' || v_search || '%'
        OR COALESCE(o.supplier_order_reference, '') ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (SELECT count(*) AS c FROM base),
  paged AS (
    SELECT * FROM base
    ORDER BY order_date DESC, created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    p.id,
    p.import_number,
    p.supplier_id,
    p.supplier_name,
    p.purchase_type,
    p.status,
    p.currency_code,
    p.order_date,
    p.estimated_arrival_date,
    COALESCE(it.ordered_units, 0)::bigint,
    COALESCE(it.received_units, 0)::bigint,
    COALESCE(it.goods_cost_ils, 0)::numeric,
    COALESCE(c.costs_ils, 0)::numeric,
    (COALESCE(it.goods_cost_ils, 0) + COALESCE(c.costs_ils, 0))::numeric,
    COALESCE(pm.paid_ils, 0)::numeric,
    GREATEST(
      (COALESCE(it.goods_cost_ils, 0) + COALESCE(c.costs_ils, 0)) - COALESCE(pm.paid_ils, 0),
      0
    )::numeric,
    (SELECT c FROM counted)
  FROM paged p
  LEFT JOIN LATERAL (
    SELECT sum(i.ordered_quantity) AS ordered_units,
           sum(i.received_quantity) AS received_units,
           sum(round(i.ordered_quantity * COALESCE(
                 i.expected_unit_cost_ils,
                 i.supplier_unit_cost * COALESCE(p.working_exchange_rate_to_ils, 1)
               ), 2)) AS goods_cost_ils
    FROM public.import_order_items i
    WHERE i.import_order_id = p.id AND i.item_status <> 'cancelled'
  ) it ON true
  LEFT JOIN LATERAL (
    SELECT sum(x.amount_ils) AS costs_ils
    FROM public.import_costs x WHERE x.import_order_id = p.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT sum(y.amount_ils) AS paid_ils
    FROM public.import_payments y
    WHERE y.import_order_id = p.id AND y.payment_status = 'paid'
  ) pm ON true;
END;
$$;

-- Per-item expected landed cost + margin (read model only; never written to products)
CREATE OR REPLACE FUNCTION public.import_order_landed_cost(p_import_order_id uuid)
RETURNS TABLE (
  item_id uuid,
  product_id uuid,
  product_description text,
  ordered_quantity integer,
  received_quantity integer,
  unit_purchase_cost_ils numeric,
  overhead_per_unit_ils numeric,
  expected_landed_unit_cost_ils numeric,
  planned_sale_price_ils numeric,
  expected_gross_profit_per_unit_ils numeric,
  expected_gross_margin_percent numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business uuid;
  v_rate numeric;
  v_overhead numeric;
  v_units numeric;
  v_per_unit numeric;
BEGIN
  SELECT o.business_id, COALESCE(o.working_exchange_rate_to_ils, 1)
    INTO v_business, v_rate
  FROM public.import_orders o WHERE o.id = p_import_order_id;

  IF v_business IS NULL OR NOT public.can_manage_business_imports(v_business, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(sum(amount_ils), 0) INTO v_overhead
  FROM public.import_costs WHERE import_order_id = p_import_order_id;

  SELECT COALESCE(sum(ordered_quantity), 0) INTO v_units
  FROM public.import_order_items
  WHERE import_order_id = p_import_order_id AND item_status <> 'cancelled';

  v_per_unit := CASE WHEN v_units > 0 THEN round(v_overhead / v_units, 4) ELSE NULL END;

  RETURN QUERY
  SELECT
    i.id,
    i.product_id,
    i.product_description,
    i.ordered_quantity,
    i.received_quantity,
    round(COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate), 4),
    v_per_unit,
    CASE WHEN v_per_unit IS NULL THEN NULL
         ELSE round(COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit, 4) END,
    i.planned_sale_price_ils,
    CASE WHEN v_per_unit IS NULL OR i.planned_sale_price_ils IS NULL THEN NULL
         ELSE round(i.planned_sale_price_ils
              - (COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit), 4) END,
    CASE WHEN v_per_unit IS NULL OR i.planned_sale_price_ils IS NULL OR i.planned_sale_price_ils = 0 THEN NULL
         ELSE round(((i.planned_sale_price_ils
              - (COALESCE(i.expected_unit_cost_ils, i.supplier_unit_cost * v_rate) + v_per_unit))
              / i.planned_sale_price_ils) * 100, 2) END
  FROM public.import_order_items i
  WHERE i.import_order_id = p_import_order_id
  ORDER BY i.created_at;
END;
$$;

-- Derived quantity-in-transit, bounded by an explicit product id list (max 100).
CREATE OR REPLACE FUNCTION public.import_quantity_in_transit(p_business_id uuid, p_product_ids uuid[])
RETURNS TABLE (product_id uuid, quantity_in_transit bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_manage_business_imports(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  IF array_length(p_product_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Too many product ids (max 100)';
  END IF;

  RETURN QUERY
  SELECT i.product_id, SUM(GREATEST(i.ordered_quantity - i.received_quantity, 0))::bigint
  FROM public.import_order_items i
  JOIN public.import_orders o ON o.id = i.import_order_id
  WHERE i.business_id = p_business_id
    AND i.product_id = ANY(p_product_ids)
    AND i.item_status NOT IN ('received', 'cancelled')
    AND o.status IN ('ordered','preparing','shipped','in_transit',
                     'arrived_israel','customs_clearance','receiving')
  GROUP BY i.product_id;
END;
$$;

-- Function grants: authenticated only, never anon/PUBLIC
REVOKE ALL ON FUNCTION public.import_pin_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_pin_set(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_pin_verify(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_pin_session_touch(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_pin_lock(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_orders_page(uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_order_landed_cost(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.import_quantity_in_transit(uuid, uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.import_pin_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_pin_set(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_pin_verify(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_pin_session_touch(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_pin_lock(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_orders_page(uuid, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_order_landed_cost(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_quantity_in_transit(uuid, uuid[]) TO authenticated, service_role;