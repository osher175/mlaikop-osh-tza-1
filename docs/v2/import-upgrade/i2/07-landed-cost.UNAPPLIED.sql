-- UNAPPLIED. Do not execute until a separate approval.
-- Shared expenses and allocation. Does not change import_order_landed_cost,
-- products.cost, or historical import_cost_adjustments.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.import_shared_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id),
  shipment_id uuid,
  container_id uuid,
  category text NOT NULL,
  description text,
  amount numeric(14,4) NOT NULL,
  currency_code text NOT NULL,
  exchange_rate_to_ils numeric(14,6),
  amount_ils numeric(14,2) NOT NULL,
  recoverable_vat_ils numeric(14,2) NOT NULL DEFAULT 0,
  capitalized_amount_ils numeric(14,2) GENERATED ALWAYS AS
    (amount_ils - recoverable_vat_ils) STORED,
  capitalize boolean NOT NULL DEFAULT false,
  cost_stage text NOT NULL DEFAULT 'provisional',
  reference text,
  cost_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_shared_expenses_container_fkey
    FOREIGN KEY (business_id, container_id)
    REFERENCES public.import_containers (business_id, id),
  CONSTRAINT i2_import_shared_expenses_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_shared_expenses_scope_check
    CHECK (container_id IS NOT NULL OR shipment_id IS NOT NULL),
  CONSTRAINT i2_import_shared_expenses_category_check
    CHECK (category IN (
      'international_freight', 'insurance', 'customs', 'taxes_fees', 'customs_broker',
      'port', 'storage', 'local_transport', 'standards_testing', 'bank_fx_fees', 'other'
    )),
  CONSTRAINT i2_import_shared_expenses_currency_check
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT i2_import_shared_expenses_amount_check
    CHECK (amount >= 0 AND amount_ils >= 0 AND recoverable_vat_ils >= 0 AND recoverable_vat_ils <= amount_ils),
  CONSTRAINT i2_import_shared_expenses_rate_check
    CHECK (
      (currency_code = 'ILS' AND exchange_rate_to_ils = 1 AND amount_ils = round(amount, 2))
      OR
      (currency_code <> 'ILS' AND exchange_rate_to_ils > 0 AND amount_ils = round(amount * exchange_rate_to_ils, 2))
    ),
  CONSTRAINT i2_import_shared_expenses_bank_check
    CHECK (category <> 'bank_fx_fees' OR capitalize = false),
  CONSTRAINT i2_import_shared_expenses_stage_check
    CHECK (cost_stage IN ('provisional', 'finalized'))
);

CREATE UNIQUE INDEX i2_import_shared_expenses_business_id_id_key
  ON public.import_shared_expenses (business_id, id);

COMMENT ON TABLE public.import_shared_expenses IS
  'Container or shipment expense that is not owned by one import order. Bank and FX fees can be recorded but cannot be capitalized. Recoverable VAT stays outside capitalized_amount_ils. No FX service is called.';

CREATE OR REPLACE FUNCTION public.i2_shared_expense_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_shipment uuid;
BEGIN
  IF NEW.container_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT shipment_id INTO v_shipment
  FROM public.import_containers
  WHERE id = NEW.container_id
    AND business_id = NEW.business_id;
  IF v_shipment IS NULL THEN
    RAISE EXCEPTION 'shared expense container belongs to a different business' USING ERRCODE = '23514';
  END IF;
  IF NEW.shipment_id IS NOT NULL AND NEW.shipment_id IS DISTINCT FROM v_shipment THEN
    RAISE EXCEPTION 'shared expense container is not on the shipment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_import_shared_expenses_scope_guard
  BEFORE INSERT OR UPDATE ON public.import_shared_expenses
  FOR EACH ROW EXECUTE FUNCTION public.i2_shared_expense_scope_guard();

CREATE TABLE public.import_cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  import_cost_id uuid,
  shared_expense_id uuid,
  shipment_id uuid,
  container_id uuid,
  import_order_id uuid,
  import_order_item_id uuid,
  basis text NOT NULL,
  stage text NOT NULL DEFAULT 'provisional',
  amount_to_allocate_ils numeric(14,2) NOT NULL,
  recoverable_vat_ils numeric(14,2) NOT NULL DEFAULT 0,
  sealed boolean NOT NULL DEFAULT false,
  cost_authority text NOT NULL DEFAULT 'worksheet',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_cost_allocations_cost_fkey
    FOREIGN KEY (business_id, import_cost_id)
    REFERENCES public.import_costs (business_id, id),
  CONSTRAINT i2_import_cost_allocations_shared_fkey
    FOREIGN KEY (business_id, shared_expense_id)
    REFERENCES public.import_shared_expenses (business_id, id),
  CONSTRAINT i2_import_cost_allocations_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_cost_allocations_container_fkey
    FOREIGN KEY (business_id, container_id)
    REFERENCES public.import_containers (business_id, id),
  CONSTRAINT i2_import_cost_allocations_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id),
  CONSTRAINT i2_import_cost_allocations_item_fkey
    FOREIGN KEY (business_id, import_order_item_id)
    REFERENCES public.import_order_items (business_id, id),
  CONSTRAINT i2_import_cost_allocations_amount_check
    CHECK (amount_to_allocate_ils >= 0 AND recoverable_vat_ils >= 0),
  CONSTRAINT i2_import_cost_allocations_stage_check
    CHECK (stage IN ('provisional', 'finalized')),
  CONSTRAINT i2_import_cost_allocations_authority_check
    CHECK (cost_authority IN ('worksheet', 'posted_receipts')),
  CONSTRAINT i2_import_cost_allocations_basis_check
    CHECK (
      (
        basis = 'per_accepted_tire'
        AND shared_expense_id IS NOT NULL
        AND import_cost_id IS NULL
        AND import_order_item_id IS NULL
        AND (container_id IS NOT NULL OR shipment_id IS NOT NULL)
      )
      OR
      (
        basis = 'direct_line'
        AND import_cost_id IS NOT NULL
        AND shared_expense_id IS NULL
        AND import_order_id IS NOT NULL
        AND import_order_item_id IS NOT NULL
        AND container_id IS NULL
        AND shipment_id IS NULL
      )
    )
);

CREATE UNIQUE INDEX i2_import_cost_allocations_business_id_id_key
  ON public.import_cost_allocations (business_id, id);

COMMENT ON TABLE public.import_cost_allocations IS
  'Worksheet split until shared receiving is authoritative. cost_authority stays worksheet, stage stays provisional, and sealed stays false. A later activation may seal only posted_receipts quantities. This does not post product cost.';

CREATE TABLE public.import_cost_allocation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  allocation_id uuid NOT NULL,
  import_order_item_id uuid NOT NULL,
  accepted_quantity integer NOT NULL,
  exact_share_ils numeric(20,6) NOT NULL,
  rounded_share_ils numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_cost_allocation_lines_allocation_fkey
    FOREIGN KEY (business_id, allocation_id)
    REFERENCES public.import_cost_allocations (business_id, id),
  CONSTRAINT i2_import_cost_allocation_lines_item_fkey
    FOREIGN KEY (business_id, import_order_item_id)
    REFERENCES public.import_order_items (business_id, id),
  CONSTRAINT i2_import_cost_allocation_lines_quantity_check
    CHECK (accepted_quantity > 0),
  CONSTRAINT i2_import_cost_allocation_lines_share_check
    CHECK (rounded_share_ils >= 0),
  UNIQUE (allocation_id, import_order_item_id)
);

COMMENT ON TABLE public.import_cost_allocation_lines IS
  'Accepted-tire shares only. Damaged and missing quantities are not rows. The rounded shares of a sealed allocation sum to amount_to_allocate_ils.';
COMMENT ON COLUMN public.import_cost_allocation_lines.accepted_quantity IS
  'Worksheet figure. It becomes a cost basis only when the parent is sealed as posted_receipts and the quantity matches posted goods receipts.';

CREATE TABLE public.import_landed_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  import_order_id uuid NOT NULL,
  allocation_id uuid,
  amount_ils numeric(14,2) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_landed_adjustments_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id),
  CONSTRAINT i2_import_landed_adjustments_allocation_fkey
    FOREIGN KEY (business_id, allocation_id)
    REFERENCES public.import_cost_allocations (business_id, id),
  CONSTRAINT i2_import_landed_adjustments_reason_check
    CHECK (length(btrim(reason)) > 0)
);

COMMENT ON TABLE public.import_landed_adjustments IS
  'Append-only later adjustment. Does not replace import_cost_adjustments and does not write products.cost or cost_snapshot_ils.';

CREATE OR REPLACE FUNCTION public.preview_shared_expense_allocation(
  p_amount_ils numeric,
  p_lines jsonb
)
RETURNS TABLE (
  line_id text,
  accepted_quantity integer,
  exact_share_ils numeric,
  rounded_share_ils numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_units bigint;
  v_agorot bigint;
  v_dup integer;
BEGIN
  IF p_amount_ils IS NULL OR p_amount_ils < 0 THEN
    RAISE EXCEPTION 'invalid allocation amount' USING ERRCODE = '23514';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'invalid allocation lines' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) AS elem
    WHERE COALESCE(btrim(elem->>'id'), '') = ''
       OR COALESCE(elem->>'accepted_quantity', '') !~ '^[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'invalid allocation line' USING ERRCODE = '23514';
  END IF;
  SELECT COUNT(*) INTO v_dup
  FROM (
    SELECT elem->>'id'
    FROM jsonb_array_elements(p_lines) AS elem
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) AS duplicated;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'duplicate allocation line id' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM((elem->>'accepted_quantity')::integer), 0)
    INTO v_units
  FROM jsonb_array_elements(p_lines) AS elem
  WHERE (elem->>'accepted_quantity')::integer > 0;

  IF v_units = 0 THEN
    IF p_amount_ils <> 0 THEN
      RAISE EXCEPTION 'no accepted tires for a non-zero shared expense' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  -- Largest remainder in agorot. Zero accepted lines are omitted.
  -- 25000 ILS across 980 accepted tires returns shares that sum to 25000.00.
  v_agorot := round(p_amount_ils * 100);

  RETURN QUERY
  WITH checked AS (
    SELECT
      elem->>'id' AS line_id,
      (elem->>'accepted_quantity')::integer AS accepted_quantity
    FROM jsonb_array_elements(p_lines) AS elem
    WHERE (elem->>'accepted_quantity')::integer > 0
  ),
  bases AS (
    SELECT
      c.line_id,
      c.accepted_quantity,
      (v_agorot * c.accepted_quantity) / v_units AS base_agorot,
      (v_agorot * c.accepted_quantity) % v_units AS remainder_num
    FROM checked AS c
  ),
  ranked AS (
    SELECT
      b.line_id,
      b.accepted_quantity,
      b.base_agorot,
      b.remainder_num,
      ROW_NUMBER() OVER (ORDER BY b.remainder_num DESC, b.line_id ASC) AS rank,
      v_agorot - (SUM(b.base_agorot) OVER ())::bigint AS leftover
    FROM bases AS b
  )
  SELECT
    r.line_id,
    r.accepted_quantity,
    round((p_amount_ils * r.accepted_quantity::numeric) / v_units::numeric, 6) AS exact_share_ils,
    ((r.base_agorot + CASE WHEN r.rank <= r.leftover THEN 1 ELSE 0 END)::numeric / 100) AS rounded_share_ils
  FROM ranked AS r;
END;
$fn$;

COMMENT ON FUNCTION public.preview_shared_expense_allocation(numeric, jsonb) IS
  'Pure arithmetic preview. Caller-supplied quantities are not receipt records and the result is not a production cost. Revoked until a later phase.';

CREATE OR REPLACE FUNCTION public.i2_shared_receiving_authoritative()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
BEGIN
  IF to_regclass('public.goods_receipts') IS NULL THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'i2_goods_receipts_block_posting'
      AND tgrelid = 'public.goods_receipts'::regclass
      AND NOT tgisinternal
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.i2_posted_accepted_quantity(
  p_business_id uuid,
  p_import_order_item_id uuid,
  p_shipment_id uuid,
  p_container_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_qty integer;
BEGIN
  IF to_regclass('public.goods_receipt_lines') IS NULL THEN
    RETURN 0;
  END IF;
  EXECUTE $q$
    SELECT COALESCE(SUM(l.accepted_quantity), 0)::integer
    FROM public.goods_receipt_lines AS l
    JOIN public.goods_receipts AS r
      ON r.id = l.goods_receipt_id
     AND r.business_id = l.business_id
    LEFT JOIN public.import_shipment_lines AS s
      ON s.id = l.import_shipment_line_id
     AND s.business_id = l.business_id
    WHERE r.business_id = $1
      AND r.status = 'posted'
      AND (
        l.import_order_item_id = $2
        OR s.import_order_item_id = $2
      )
      AND ($3::uuid IS NULL OR s.shipment_id = $3)
      AND ($4::uuid IS NULL OR s.container_id = $4)
  $q$
  INTO v_qty
  USING p_business_id, p_import_order_item_id, p_shipment_id, p_container_id;
  RETURN COALESCE(v_qty, 0);
END;
$fn$;

COMMENT ON FUNCTION public.i2_shared_receiving_authoritative() IS
  'False while goods receipt posting is blocked. Allocation cannot become a production cost until this returns true.';
COMMENT ON FUNCTION public.i2_posted_accepted_quantity(uuid, uuid, uuid, uuid) IS
  'Posted accepted quantity for one order line, optionally limited to a shipment or container. Draft receipts are ignored.';

CREATE OR REPLACE FUNCTION public.i2_allocation_enforce()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_parent public.import_cost_allocations%ROWTYPE;
  v_target numeric(14,2);
  v_sum numeric(14,2);
  v_cap numeric(14,2);
  v_flag boolean;
  v_container_shipment uuid;
  v_item_order uuid;
  v_cost_order uuid;
  v_already numeric(14,2);
BEGIN
  IF TG_TABLE_NAME = 'import_cost_allocation_lines' THEN
    SELECT * INTO v_parent
    FROM public.import_cost_allocations
    WHERE id = COALESCE(NEW.allocation_id, OLD.allocation_id)
      AND business_id = COALESCE(NEW.business_id, OLD.business_id)
    FOR UPDATE;
    IF v_parent.id IS NULL THEN
      RAISE EXCEPTION 'allocation line has no parent' USING ERRCODE = '23514';
    END IF;
    IF v_parent.sealed THEN
      RAISE EXCEPTION 'sealed allocation lines are frozen' USING ERRCODE = '0A000';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    IF v_parent.business_id IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'allocation line belongs to a different business' USING ERRCODE = '23514';
    END IF;
    PERFORM 1
    FROM public.import_order_items
    WHERE id = NEW.import_order_item_id
      AND business_id = NEW.business_id
    FOR UPDATE;
    IF v_parent.basis = 'direct_line'
       AND NEW.import_order_item_id IS DISTINCT FROM v_parent.import_order_item_id THEN
      RAISE EXCEPTION 'allocation line is outside the parent order line' USING ERRCODE = '23514';
    END IF;
    IF v_parent.basis = 'per_accepted_tire' THEN
      SELECT import_order_id INTO v_item_order
      FROM public.import_order_items
      WHERE id = NEW.import_order_item_id
        AND business_id = NEW.business_id;
      IF v_item_order IS NULL THEN
        RAISE EXCEPTION 'allocation line belongs to a different business' USING ERRCODE = '23514';
      END IF;
      IF v_parent.import_order_id IS NOT NULL
         AND v_item_order IS DISTINCT FROM v_parent.import_order_id THEN
        RAISE EXCEPTION 'allocation line is outside the parent order' USING ERRCODE = '23514';
      END IF;
      IF v_parent.shipment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.import_shipment_orders
        WHERE shipment_id = v_parent.shipment_id
          AND import_order_id = v_item_order
          AND business_id = NEW.business_id
      ) THEN
        RAISE EXCEPTION 'allocation line is outside the parent shipment' USING ERRCODE = '23514';
      END IF;
      IF v_parent.container_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.import_container_orders
        WHERE container_id = v_parent.container_id
          AND import_order_id = v_item_order
          AND business_id = NEW.business_id
      ) THEN
        RAISE EXCEPTION 'allocation line is outside the parent container' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF public.i2_shared_receiving_authoritative()
       AND NEW.accepted_quantity IS DISTINCT FROM public.i2_posted_accepted_quantity(
         NEW.business_id,
         NEW.import_order_item_id,
         v_parent.shipment_id,
         v_parent.container_id
       ) THEN
      RAISE EXCEPTION 'accepted quantity must come from posted receipts' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.sealed THEN
      RAISE EXCEPTION 'sealed allocation cannot be removed' USING ERRCODE = '0A000';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.container_id IS NOT NULL THEN
    SELECT shipment_id INTO v_container_shipment
    FROM public.import_containers
    WHERE id = NEW.container_id
      AND business_id = NEW.business_id;
    IF v_container_shipment IS NULL THEN
      RAISE EXCEPTION 'allocation container belongs to a different business' USING ERRCODE = '23514';
    END IF;
    IF NEW.shipment_id IS NOT NULL AND NEW.shipment_id IS DISTINCT FROM v_container_shipment THEN
      RAISE EXCEPTION 'allocation container is not on the shipment' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.basis = 'direct_line' THEN
    SELECT import_order_id INTO v_item_order
    FROM public.import_order_items
    WHERE id = NEW.import_order_item_id
      AND business_id = NEW.business_id;
    IF v_item_order IS DISTINCT FROM NEW.import_order_id THEN
      RAISE EXCEPTION 'direct allocation line is not on the order' USING ERRCODE = '23514';
    END IF;
    SELECT import_order_id INTO v_cost_order
    FROM public.import_costs
    WHERE id = NEW.import_cost_id
      AND business_id = NEW.business_id
    FOR UPDATE;
    IF v_cost_order IS DISTINCT FROM NEW.import_order_id THEN
      RAISE EXCEPTION 'direct allocation cost belongs to a different order' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.shared_expense_id IS NOT NULL THEN
    SELECT capitalize, capitalized_amount_ils
      INTO v_flag, v_cap
    FROM public.import_shared_expenses
    WHERE id = NEW.shared_expense_id
      AND business_id = NEW.business_id
    FOR UPDATE;
    IF v_flag IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'shared expense is not marked for capitalization' USING ERRCODE = '23514';
    END IF;
    PERFORM 1
    FROM public.import_cost_allocations
    WHERE shared_expense_id = NEW.shared_expense_id
      AND business_id = NEW.business_id
      AND id IS DISTINCT FROM NEW.id
    FOR UPDATE;
    SELECT COALESCE(SUM(amount_to_allocate_ils), 0) INTO v_already
    FROM public.import_cost_allocations
    WHERE shared_expense_id = NEW.shared_expense_id
      AND business_id = NEW.business_id
      AND id IS DISTINCT FROM NEW.id;
    IF v_already + NEW.amount_to_allocate_ils > v_cap THEN
      RAISE EXCEPTION 'allocations capitalize the shared expense more than once' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT public.i2_shared_receiving_authoritative() THEN
    IF NEW.sealed
       OR NEW.stage IS DISTINCT FROM 'provisional'
       OR NEW.cost_authority IS DISTINCT FROM 'worksheet' THEN
      RAISE EXCEPTION 'landed-cost allocation is not a production-authoritative cost' USING ERRCODE = '0A000';
    END IF;
  ELSIF NEW.sealed AND NEW.cost_authority IS DISTINCT FROM 'posted_receipts' THEN
    RAISE EXCEPTION 'sealed allocation must use posted receipt quantities' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.sealed THEN
      IF NEW.sealed IS DISTINCT FROM true
         OR NEW.amount_to_allocate_ils IS DISTINCT FROM OLD.amount_to_allocate_ils
         OR NEW.recoverable_vat_ils IS DISTINCT FROM OLD.recoverable_vat_ils
         OR NEW.basis IS DISTINCT FROM OLD.basis
         OR NEW.import_cost_id IS DISTINCT FROM OLD.import_cost_id
         OR NEW.shared_expense_id IS DISTINCT FROM OLD.shared_expense_id
         OR NEW.shipment_id IS DISTINCT FROM OLD.shipment_id
         OR NEW.container_id IS DISTINCT FROM OLD.container_id
         OR NEW.import_order_id IS DISTINCT FROM OLD.import_order_id
         OR NEW.import_order_item_id IS DISTINCT FROM OLD.import_order_item_id
         OR NEW.business_id IS DISTINCT FROM OLD.business_id
         OR NEW.cost_authority IS DISTINCT FROM OLD.cost_authority THEN
        RAISE EXCEPTION 'sealed allocation amounts are frozen' USING ERRCODE = '0A000';
      END IF;
    END IF;
  END IF;

  IF NEW.sealed AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NOT OLD.sealed)) THEN
    SELECT COALESCE(SUM(rounded_share_ils), 0) INTO v_sum
    FROM public.import_cost_allocation_lines
    WHERE allocation_id = NEW.id
      AND business_id = NEW.business_id;
    v_target := NEW.amount_to_allocate_ils;
    IF v_sum IS DISTINCT FROM v_target THEN
      RAISE EXCEPTION 'allocation lines do not reconcile to the allocated amount' USING ERRCODE = '23514';
    END IF;
    IF public.i2_shared_receiving_authoritative() AND EXISTS (
      SELECT 1
      FROM public.import_cost_allocation_lines AS line
      WHERE line.allocation_id = NEW.id
        AND line.business_id = NEW.business_id
        AND line.accepted_quantity IS DISTINCT FROM public.i2_posted_accepted_quantity(
          line.business_id,
          line.import_order_item_id,
          NEW.shipment_id,
          NEW.container_id
        )
    ) THEN
      RAISE EXCEPTION 'accepted quantity must come from posted receipts' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_import_cost_allocations_enforce
  BEFORE INSERT OR UPDATE OR DELETE ON public.import_cost_allocations
  FOR EACH ROW EXECUTE FUNCTION public.i2_allocation_enforce();
CREATE TRIGGER i2_import_cost_allocation_lines_enforce
  BEFORE INSERT OR UPDATE OR DELETE ON public.import_cost_allocation_lines
  FOR EACH ROW EXECUTE FUNCTION public.i2_allocation_enforce();
CREATE TRIGGER i2_import_landed_adjustments_append_only
  BEFORE UPDATE OR DELETE ON public.import_landed_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.i2_reject_append_only();

REVOKE ALL ON TABLE
  public.import_shared_expenses,
  public.import_cost_allocations,
  public.import_cost_allocation_lines,
  public.import_landed_adjustments
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.import_shared_expenses,
  public.import_cost_allocations,
  public.import_cost_allocation_lines,
  public.import_landed_adjustments
  TO authenticated;

ALTER TABLE public.import_shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shared_expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost_allocation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_cost_allocation_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_landed_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_landed_adjustments FORCE ROW LEVEL SECURITY;

CREATE POLICY i2_import_shared_expenses_select ON public.import_shared_expenses
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_cost_allocations_select ON public.import_cost_allocations
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_cost_allocation_lines_select ON public.import_cost_allocation_lines
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_landed_adjustments_select ON public.import_landed_adjustments
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));

REVOKE ALL ON FUNCTION public.preview_shared_expense_allocation(numeric, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_allocation_enforce()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_shared_expense_scope_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_shared_receiving_authoritative()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_posted_accepted_quantity(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
