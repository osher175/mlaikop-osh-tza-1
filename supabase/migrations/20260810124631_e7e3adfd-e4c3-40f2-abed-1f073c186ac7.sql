
-- 1. Single-row estimate/final model on import_costs -----------------------
ALTER TABLE public.import_costs
  ADD COLUMN IF NOT EXISTS final_amount numeric,
  ADD COLUMN IF NOT EXISTS final_exchange_rate_to_ils numeric,
  ADD COLUMN IF NOT EXISTS final_invoice_reference text,
  ADD COLUMN IF NOT EXISTS final_cost_date date,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid;

ALTER TABLE public.import_costs
  ADD CONSTRAINT import_costs_final_amount_check
    CHECK (final_amount IS NULL OR final_amount >= 0),
  ADD CONSTRAINT import_costs_final_rate_check
    CHECK (final_exchange_rate_to_ils IS NULL OR final_exchange_rate_to_ils > 0),
  ADD CONSTRAINT import_costs_final_rate_requires_amount
    CHECK (final_exchange_rate_to_ils IS NULL OR final_amount IS NOT NULL);

-- Backfill: rows already flagged 'final' keep their exact effective value.
UPDATE public.import_costs
   SET final_amount = amount,
       final_exchange_rate_to_ils = exchange_rate_to_ils,
       finalized_at = COALESCE(finalized_at, updated_at)
 WHERE cost_state = 'final' AND final_amount IS NULL;

-- Derived money columns (stored generated, immutable expressions).
ALTER TABLE public.import_costs
  ADD COLUMN final_amount_ils numeric
    GENERATED ALWAYS AS (
      CASE WHEN final_amount IS NULL THEN NULL
           ELSE round(final_amount * COALESCE(final_exchange_rate_to_ils, exchange_rate_to_ils, 1), 2)
      END
    ) STORED,
  ADD COLUMN effective_amount_ils numeric
    GENERATED ALWAYS AS (
      CASE WHEN final_amount IS NULL
           THEN round(amount * COALESCE(exchange_rate_to_ils, 1), 2)
           ELSE round(final_amount * COALESCE(final_exchange_rate_to_ils, exchange_rate_to_ils, 1), 2)
      END
    ) STORED,
  ADD COLUMN variance_ils numeric
    GENERATED ALWAYS AS (
      CASE WHEN final_amount IS NULL THEN NULL
           ELSE round(final_amount * COALESCE(final_exchange_rate_to_ils, exchange_rate_to_ils, 1), 2)
                - round(amount * COALESCE(exchange_rate_to_ils, 1), 2)
      END
    ) STORED,
  ADD COLUMN variance_percent numeric
    GENERATED ALWAYS AS (
      CASE WHEN final_amount IS NULL OR round(amount * COALESCE(exchange_rate_to_ils, 1), 2) = 0 THEN NULL
           ELSE round(
                  ( round(final_amount * COALESCE(final_exchange_rate_to_ils, exchange_rate_to_ils, 1), 2)
                    - round(amount * COALESCE(exchange_rate_to_ils, 1), 2) )
                  / round(amount * COALESCE(exchange_rate_to_ils, 1), 2) * 100, 2)
      END
    ) STORED;

COMMENT ON COLUMN public.import_costs.amount IS 'Estimated (original) amount for this cost line, in currency_code.';
COMMENT ON COLUMN public.import_costs.final_amount IS 'Final/invoiced amount for the SAME cost line. When present it replaces the estimate for landed cost; the estimate is preserved for history.';
COMMENT ON COLUMN public.import_costs.effective_amount_ils IS 'COALESCE(final, estimate) in ILS — the only value landed cost may sum. Never estimate + final.';

-- 2. cost_state is now derived from final_amount ---------------------------
CREATE OR REPLACE FUNCTION public.import_costs_sync_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.cost_state := CASE WHEN NEW.final_amount IS NOT NULL THEN 'final' ELSE 'estimated' END;
  IF NEW.final_amount IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.final_amount IS NULL) THEN
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
    NEW.finalized_by := COALESCE(NEW.finalized_by, auth.uid());
  ELSIF NEW.final_amount IS NULL THEN
    NEW.finalized_at := NULL;
    NEW.finalized_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_import_costs_state ON public.import_costs;
CREATE TRIGGER trg_import_costs_state
BEFORE INSERT OR UPDATE ON public.import_costs
FOR EACH ROW EXECUTE FUNCTION public.import_costs_sync_state();

-- 3. Audit: cost_finalized ------------------------------------------------
ALTER TABLE public.import_events DROP CONSTRAINT IF EXISTS import_events_event_type_check;
ALTER TABLE public.import_events ADD CONSTRAINT import_events_event_type_check
  CHECK (event_type = ANY (ARRAY['order_created','status_changed','eta_changed','cost_added',
    'cost_updated','cost_finalized','payment_added','document_uploaded','receiving_started',
    'receipt_confirmed','receipt_corrected','order_closed','order_reopened']));

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
    IF TG_OP = 'UPDATE' AND NEW.final_amount IS NOT NULL AND OLD.final_amount IS NULL THEN
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (NEW.import_order_id, NEW.business_id, 'cost_finalized', auth.uid(),
              jsonb_build_object('category', NEW.category,
                                 'estimated_ils', NEW.amount_ils,
                                 'final_ils', NEW.final_amount_ils,
                                 'variance_ils', NEW.variance_ils,
                                 'variance_percent', NEW.variance_percent));
    ELSE
      INSERT INTO public.import_events (import_order_id, business_id, event_type, actor_user_id, metadata)
      VALUES (NEW.import_order_id, NEW.business_id,
              CASE WHEN TG_OP = 'INSERT' THEN 'cost_added' ELSE 'cost_updated' END, auth.uid(),
              jsonb_build_object('category', NEW.category,
                                 'estimated_ils', NEW.amount_ils,
                                 'final_ils', NEW.final_amount_ils,
                                 'effective_ils', NEW.effective_amount_ils,
                                 'cost_state', NEW.cost_state));
    END IF;
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

-- 4. Landed cost must sum EFFECTIVE values only ---------------------------
CREATE OR REPLACE FUNCTION public.import_order_landed_cost(p_import_order_id uuid)
RETURNS TABLE(item_id uuid, product_id uuid, product_description text, ordered_quantity integer,
              received_quantity integer, unit_purchase_cost_ils numeric, overhead_per_unit_ils numeric,
              expected_landed_unit_cost_ils numeric, planned_sale_price_ils numeric,
              expected_gross_profit_per_unit_ils numeric, expected_gross_margin_percent numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

  -- One row per logical cost line; effective_amount_ils = final when present, else estimate.
  -- Estimates and finals of the same line are NEVER summed together.
  SELECT COALESCE(sum(effective_amount_ils), 0) INTO v_overhead
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

REVOKE ALL ON FUNCTION public.import_order_landed_cost(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_order_landed_cost(uuid) TO authenticated;

-- 5. Cost summary read model (estimated vs final vs effective) ------------
CREATE OR REPLACE FUNCTION public.import_order_cost_summary(p_import_order_id uuid)
RETURNS TABLE(lines integer, finalized_lines integer, estimated_total_ils numeric,
              final_total_ils numeric, effective_total_ils numeric,
              variance_ils numeric, variance_percent numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_business uuid;
BEGIN
  SELECT o.business_id INTO v_business FROM public.import_orders o WHERE o.id = p_import_order_id;
  IF v_business IS NULL OR NOT public.can_manage_business_imports(v_business, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH c AS (
    SELECT * FROM public.import_costs WHERE import_order_id = p_import_order_id
  ), t AS (
    SELECT count(*)::int AS lines,
           count(*) FILTER (WHERE final_amount IS NOT NULL)::int AS finalized_lines,
           COALESCE(sum(amount_ils), 0) AS est_total,
           COALESCE(sum(final_amount_ils), 0) AS fin_total,
           COALESCE(sum(effective_amount_ils), 0) AS eff_total
    FROM c
  )
  SELECT t.lines, t.finalized_lines, t.est_total, t.fin_total, t.eff_total,
         round(t.eff_total - t.est_total, 2),
         CASE WHEN t.est_total = 0 THEN NULL
              ELSE round((t.eff_total - t.est_total) / t.est_total * 100, 2) END
  FROM t;
END;
$$;

REVOKE ALL ON FUNCTION public.import_order_cost_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_order_cost_summary(uuid) TO authenticated;
