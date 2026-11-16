-- UNAPPLIED. DO NOT EXECUTE. NOT AN APPROVED MIGRATION.
-- Outside supabase/migrations so the migration tool cannot deploy it.
--
-- SUPERSEDED FOR EXECUTION by docs/v2/production-upgrade/02_sale_tables.additive.sql
-- and 03_sale_functions.additive.sql. Do not apply this file as well.
-- Applying both fails closed because the tables or functions already exist.
--
-- Authoritative multi-line sale.
-- Depends on Task 1A public.employees
-- (docs/task-1a/01_additive_foundation.proposed.sql). Does not create employees.
-- Do not also apply docs/v2/employee-sales-attribution.UNAPPLIED.sql.
--
-- Records
--   sale_transactions          transaction identity, salesperson, VAT snapshot, status
--   sale_lines                 money and quantity. One inventory deduction each.
--   inventory_actions          audit movement only. sale_total_ils stays NULL so the
--                              legacy dashboard query cannot count the same sale twice.
-- Legacy sales remain inventory_actions rows that already have sale_total_ils.
-- Reporting unions those rows with sale_lines. Source is the table, not a guess.
--
-- Activation, after explicit approval, in order:
--   1. Apply Task 1A employees.
--   2. Apply this file.
--   3. Regenerate src/integrations/supabase/types.ts.
--   4. Only then set EMPLOYEES_DIRECTORY_READY, QUICK_SALE_PERSISTENCE_READY
--      and EMPLOYEE_SALES_ATTRIBUTION_READY to true together.
--
-- Rollback before any sale is written: drop the two functions, the trigger,
-- and the two tables. Do not drop employees here. Do not delete inventory_actions.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION 'quick sale requires the unapplied Task 1A public.employees table';
  END IF;
  IF to_regclass('public.sale_transactions') IS NOT NULL OR to_regclass('public.sale_lines') IS NOT NULL THEN
    RAISE EXCEPTION 'quick sale tables already exist';
  END IF;
END;
$preconditions$;

CREATE TABLE public.sale_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  sold_at timestamptz NOT NULL DEFAULT now(),
  salesperson_employee_id uuid NULL,
  status text NOT NULL DEFAULT 'completed',
  notes text NULL,
  vat_rate numeric(6, 4) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  created_by uuid NOT NULL,
  reversed_at timestamptz NULL,
  reversed_by uuid NULL,
  CONSTRAINT sale_transactions_business_id_id_key UNIQUE (business_id, id),
  CONSTRAINT sale_transactions_idempotency_key UNIQUE (business_id, idempotency_key),
  CONSTRAINT sale_transactions_status_check CHECK (status IN ('completed', 'reversed')),
  CONSTRAINT sale_transactions_vat_check CHECK (vat_rate >= 0 AND vat_rate < 1),
  CONSTRAINT sale_transactions_notes_check CHECK (notes IS NULL OR length(notes) <= 500),
  CONSTRAINT sale_transactions_reversal_check CHECK (
    (status = 'completed' AND reversed_at IS NULL AND reversed_by IS NULL)
    OR (status = 'reversed' AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL)
  )
);

ALTER TABLE public.sale_transactions
  ADD CONSTRAINT sale_transactions_salesperson_fkey
  FOREIGN KEY (business_id, salesperson_employee_id)
  REFERENCES public.employees (business_id, id)
  ON DELETE RESTRICT;

CREATE TABLE public.sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  product_id uuid NOT NULL,
  position integer NOT NULL,
  quantity integer NOT NULL,
  unit_price_gross_ils numeric(14, 2) NOT NULL,
  vat_rate numeric(6, 4) NOT NULL,
  unit_cost_ils numeric(14, 2) NULL,
  inventory_action_id uuid NULL,
  axle text NOT NULL DEFAULT 'single',
  CONSTRAINT sale_lines_business_id_id_key UNIQUE (business_id, id),
  CONSTRAINT sale_lines_position_key UNIQUE (transaction_id, position),
  CONSTRAINT sale_lines_action_key UNIQUE (inventory_action_id),
  CONSTRAINT sale_lines_quantity_check CHECK (quantity > 0),
  CONSTRAINT sale_lines_price_check CHECK (unit_price_gross_ils >= 0),
  CONSTRAINT sale_lines_cost_check CHECK (unit_cost_ils IS NULL OR unit_cost_ils >= 0),
  CONSTRAINT sale_lines_axle_check CHECK (axle IN ('single', 'front', 'rear')),
  CONSTRAINT sale_lines_transaction_fkey
    FOREIGN KEY (business_id, transaction_id)
    REFERENCES public.sale_transactions (business_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT sale_lines_product_fkey
    FOREIGN KEY (product_id) REFERENCES public.products (id) ON DELETE RESTRICT,
  CONSTRAINT sale_lines_action_fkey
    FOREIGN KEY (inventory_action_id) REFERENCES public.inventory_actions (id) ON DELETE RESTRICT
);

CREATE INDEX sale_transactions_business_sold_idx
  ON public.sale_transactions (business_id, sold_at)
  WHERE status = 'completed';
CREATE INDEX sale_lines_business_transaction_idx
  ON public.sale_lines (business_id, transaction_id);

COMMENT ON TABLE public.sale_transactions IS
  'One completed quick sale. Revenue, VAT, attribution and transaction count use this row plus its lines. inventory_actions are the stock audit, not a second sale.';
COMMENT ON COLUMN public.sale_lines.unit_cost_ils IS
  'Ex-VAT unit cost copied from products.cost at confirmation. NULL is unknown. Zero is a genuine zero and is not rewritten.';
COMMENT ON COLUMN public.sale_transactions.salesperson_employee_id IS
  'Active employee of this business at confirmation. NULL is an explicit unattributed sale. Never inventory_actions.user_id.';

REVOKE ALL ON public.sale_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sale_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sale_transactions TO authenticated;
GRANT SELECT ON public.sale_lines TO authenticated;
GRANT ALL ON public.sale_transactions TO service_role;
GRANT ALL ON public.sale_lines TO service_role;

ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_transactions_member_read ON public.sale_transactions
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
CREATE POLICY sale_lines_member_read ON public.sale_lines
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

-- Block the existing single-action reversal from splitting a multi-line sale.
CREATE FUNCTION public.guard_quick_sale_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF OLD.reference_type = 'sale_transaction'
     AND (NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.is_reversal IS DISTINCT FROM OLD.is_reversal)
     AND current_setting('mlaiko.quick_sale_reversal', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'A quick-sale movement can be reversed only through reverse_quick_sale'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_quick_sale_movement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_quick_sale_movement
  BEFORE UPDATE ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_quick_sale_movement();

CREATE FUNCTION public.complete_quick_sale(
  p_business_id uuid,
  p_idempotency_key uuid,
  p_salesperson_employee_id uuid,
  p_notes text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_txn uuid;
  v_active boolean;
  v_line jsonb;
  v_index integer := 0;
  v_product uuid;
  v_qty integer;
  v_price numeric(14, 2);
  v_axle text;
  v_stock integer;
  v_cost numeric;
  v_action uuid;
  v_needed integer;
  v_vat numeric(6, 4) := 0.1800; -- src/lib/financialConfig.ts VAT_RATE
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_business_id IS NULL OR p_idempotency_key IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid quick sale';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  IF jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 50 THEN
    RAISE EXCEPTION 'a sale needs between 1 and 50 lines';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
    RAISE EXCEPTION 'notes are too long';
  END IF;

  SELECT id INTO v_existing
  FROM public.sale_transactions
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
  END IF;

  IF p_salesperson_employee_id IS NOT NULL THEN
    SELECT e.is_active INTO v_active
    FROM public.employees e
    WHERE e.id = p_salesperson_employee_id AND e.business_id = p_business_id;
    IF v_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'salesperson must be an active employee of this business' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Lock every involved product once, in a stable order.
  PERFORM p.id
  FROM public.products p
  WHERE p.business_id = p_business_id
    AND p.id IN (
      SELECT (line->>'product_id')::uuid
      FROM jsonb_array_elements(p_lines) line
    )
  ORDER BY p.id
  FOR UPDATE;

  FOR v_product, v_needed IN
    SELECT (line->>'product_id')::uuid, SUM((line->>'quantity')::integer)
    FROM jsonb_array_elements(p_lines) line
    GROUP BY 1
  LOOP
    IF v_needed IS NULL OR v_needed < 1 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;
    SELECT quantity INTO v_stock
    FROM public.products
    WHERE id = v_product AND business_id = p_business_id;
    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'product is not in this business';
    END IF;
    IF v_stock < v_needed THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  INSERT INTO public.sale_transactions (
    business_id, idempotency_key, salesperson_employee_id, notes, vat_rate, created_by
  ) VALUES (
    p_business_id, p_idempotency_key, p_salesperson_employee_id, NULLIF(btrim(p_notes), ''), v_vat, v_uid
  )
  ON CONFLICT (business_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_txn;

  IF v_txn IS NULL THEN
    SELECT id INTO v_existing
    FROM public.sale_transactions
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_index := v_index + 1;
    v_product := (v_line->>'product_id')::uuid;
    v_qty := (v_line->>'quantity')::integer;
    v_price := (v_line->>'unit_price_gross')::numeric(14, 2);
    v_axle := COALESCE(v_line->>'axle', 'single');
    IF v_qty IS NULL OR v_qty < 1 OR v_price IS NULL OR v_price < 0 OR v_axle NOT IN ('single', 'front', 'rear') THEN
      RAISE EXCEPTION 'invalid sale line';
    END IF;

    SELECT cost INTO v_cost
    FROM public.products
    WHERE id = v_product AND business_id = p_business_id;
    -- NULL stays unknown. A stored zero stays zero. Do not coerce NULL to 0.

    UPDATE public.products
    SET quantity = quantity - v_qty, updated_at = now()
    WHERE id = v_product AND business_id = p_business_id AND quantity >= v_qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      cost_snapshot_ils, sale_unit_ils, list_unit_ils, notes, timestamp,
      reference_type, reference_id, source
    ) VALUES (
      p_business_id, v_uid, v_product, 'sale', -v_qty, 'ILS',
      v_cost, v_price, v_price, 'quick sale', now(),
      'sale_transaction', v_txn, 'sale_transaction'
    )
    RETURNING id INTO v_action;

    INSERT INTO public.sale_lines (
      business_id, transaction_id, product_id, position, quantity,
      unit_price_gross_ils, vat_rate, unit_cost_ils, inventory_action_id, axle
    ) VALUES (
      p_business_id, v_txn, v_product, v_index, v_qty,
      v_price, v_vat, v_cost, v_action, v_axle
    );
  END LOOP;

  RETURN jsonb_build_object('transaction_id', v_txn, 'replayed', false);
END;
$function$;

CREATE FUNCTION public.reverse_quick_sale(p_business_id uuid, p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_line record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM public.sale_transactions
  WHERE id = p_transaction_id AND business_id = p_business_id
  FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'sale not found';
  END IF;
  IF v_status = 'reversed' THEN
    RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', true);
  END IF;

  PERFORM p.id
  FROM public.products p
  JOIN public.sale_lines l ON l.product_id = p.id AND l.business_id = p.business_id
  WHERE l.transaction_id = p_transaction_id AND l.business_id = p_business_id
  ORDER BY p.id
  FOR UPDATE;

  PERFORM set_config('mlaiko.quick_sale_reversal', 'on', true);

  FOR v_line IN
    SELECT id, product_id, quantity, inventory_action_id
    FROM public.sale_lines
    WHERE transaction_id = p_transaction_id AND business_id = p_business_id
    ORDER BY position
  LOOP
    UPDATE public.products
    SET quantity = quantity + v_line.quantity, updated_at = now()
    WHERE id = v_line.product_id AND business_id = p_business_id;

    UPDATE public.inventory_actions
    SET reversed_at = now(), reversed_by = v_uid
    WHERE id = v_line.inventory_action_id AND business_id = p_business_id AND reversed_at IS NULL;

    INSERT INTO public.inventory_actions (
      business_id, user_id, product_id, action_type, quantity_changed, currency,
      notes, timestamp, reference_type, reference_id, source,
      is_reversal, reverses_action_id
    ) VALUES (
      p_business_id, v_uid, v_line.product_id, 'sale', v_line.quantity, 'ILS',
      'quick sale reversal', now(), 'sale_transaction', p_transaction_id, 'sale_transaction',
      true, v_line.inventory_action_id
    );
  END LOOP;

  UPDATE public.sale_transactions
  SET status = 'reversed', reversed_at = now(), reversed_by = v_uid
  WHERE id = p_transaction_id AND business_id = p_business_id AND status = 'completed';

  RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_quick_sale(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_quick_sale(uuid, uuid) TO authenticated, service_role;

COMMIT;
