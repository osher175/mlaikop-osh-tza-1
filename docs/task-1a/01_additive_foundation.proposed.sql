-- TASK 1A: PROPOSAL ONLY. NOT EXECUTED. NOT AN APPROVED MIGRATION.
-- Intentionally outside supabase/migrations. Submit through the migration
-- tool ONLY after explicit approval and successful refreshed preflight.
-- New tables remain empty; no reservation creation/fulfillment RPC is added.
-- No changes to existing RPC bodies, billing rules, costs or movement history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Fail closed on incompatible data/schema. Do not silently skip drift.
DO $preconditions$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE quantity < 0) THEN
    RAISE EXCEPTION 'Task 1A requires nonnegative physical inventory';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
             WHERE attrelid = 'public.products'::regclass
               AND attname = 'reserved_quantity' AND NOT attisdropped)
     OR to_regclass('public.employees') IS NOT NULL
     OR to_regclass('public.inventory_reservation_operations') IS NOT NULL
     OR to_regclass('public.inventory_reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'Task 1A objects already exist: reconcile migration drift';
  END IF;
END;
$preconditions$;

-- Physical quantity is unchanged. No independent available-stock column.
ALTER TABLE public.products
  ADD COLUMN reserved_quantity integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT products_task1a_stock_bounds CHECK (
    quantity >= 0 AND reserved_quantity >= 0 AND reserved_quantity <= quantity
  ),
  ADD CONSTRAINT products_task1a_business_id_id_key UNIQUE (business_id, id);

-- Pure row-local arithmetic CHECKs are immutable. Time/actor/transition
-- validations below use triggers, never clock-dependent CHECK expressions.
COMMENT ON COLUMN public.products.reserved_quantity IS
  'Aggregate reserved physical units; initially zero. Client writes forbidden. Future atomic reservation RPC must maintain sum of reservation remaining_quantity under product lock. Available = quantity - reserved_quantity.';

-- Protect ONLY the new balance column; this is NOT legacy stock-write lockdown.
-- SECURITY INVOKER is essential: current_user must be the effective SQL role,
-- not the owner of this trigger function. No caller-controlled custom GUC.
CREATE FUNCTION public.task1a_guard_reserved_column()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reserved_quantity = 0 THEN RETURN NEW; END IF;
  ELSE
    IF NEW.reserved_quantity IS NOT DISTINCT FROM OLD.reserved_quantity THEN
      RETURN NEW;
    END IF;
  END IF;
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'Reserved stock is writable only by trusted inventory operations'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.task1a_guard_reserved_column() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_task1a_reserved_column
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.task1a_guard_reserved_column();

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employees_business_id_id_key UNIQUE (business_id, id),
  CONSTRAINT employees_display_name_check CHECK (
    display_name = btrim(display_name) AND length(display_name) BETWEEN 1 AND 120
  )
);
GRANT SELECT ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
REVOKE ALL ON public.employees FROM PUBLIC, anon, authenticated;
-- Remove possible direct default table grants before granting narrow columns.
GRANT SELECT ON public.employees TO authenticated;
GRANT INSERT (business_id, display_name, is_active) ON public.employees TO authenticated;
GRANT UPDATE (display_name, is_active) ON public.employees TO authenticated;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_member_read ON public.employees FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));
-- Conservative management boundary: actual business owner only.
-- No new platform-admin bypass and no reliance on profile role metadata.
CREATE POLICY employees_owner_insert ON public.employees FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_business_member(business_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.businesses b
                WHERE b.id = business_id AND b.owner_id = auth.uid()));
CREATE POLICY employees_owner_update ON public.employees FOR UPDATE TO authenticated
  USING (public.is_business_member(business_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.businesses b
                WHERE b.id = business_id AND b.owner_id = auth.uid()))
  WITH CHECK (public.is_business_member(business_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.businesses b
                WHERE b.id = business_id AND b.owner_id = auth.uid()));
-- Inactive names remain reserved to prevent historical identity reuse.
CREATE UNIQUE INDEX employees_business_display_name_uidx
  ON public.employees (business_id, lower(display_name));
CREATE INDEX employees_active_lookup_idx
  ON public.employees (business_id, display_name) WHERE is_active;

CREATE FUNCTION public.task1a_employee_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Employee identity and creation audit are immutable';
    END IF;
  ELSE
    IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Employee creator must be the authenticated actor' USING ERRCODE = '42501';
    END IF;
    IF public.is_business_member(NEW.business_id, NEW.created_by) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Employee creator is not a business member' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.task1a_employee_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_task1a_employee_audit BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.task1a_employee_audit();

-- A tenant-bound source anchor, NOT an unvalidated polymorphic foreign key.
-- reference_type/reference_id are informational provenance ONLY. Future typed
-- supplier-handover/sale parent links require their own composite FKs.
CREATE TABLE public.inventory_reservation_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  reference_type text NOT NULL,
  reference_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_operations_business_id_id_key UNIQUE (business_id, id),
  CONSTRAINT reservation_operations_reference_key UNIQUE (business_id, reference_type, reference_id),
  CONSTRAINT reservation_operations_reference_type_check CHECK (
    reference_type = btrim(reference_type) AND length(reference_type) BETWEEN 1 AND 80
  )
);
GRANT SELECT ON public.inventory_reservation_operations TO authenticated;
GRANT ALL ON public.inventory_reservation_operations TO service_role;
REVOKE ALL ON public.inventory_reservation_operations FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.inventory_reservation_operations FROM authenticated;
ALTER TABLE public.inventory_reservation_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservation_operations_member_read
  ON public.inventory_reservation_operations FOR SELECT TO authenticated
  USING (public.is_business_member(business_id, auth.uid()));

CREATE FUNCTION public.task1a_reservation_operation_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Reservation operation provenance is immutable';
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operation creator must be the authenticated actor' USING ERRCODE = '42501';
  END IF;
  IF public.is_business_member(NEW.business_id, NEW.created_by) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Operation creator is not a business member' USING ERRCODE = '42501';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.task1a_reservation_operation_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_task1a_reservation_operation_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_reservation_operations
  FOR EACH ROW EXECUTE FUNCTION public.task1a_reservation_operation_audit();

CREATE TABLE public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  source_operation_id uuid NOT NULL,
  original_quantity integer NOT NULL,
  remaining_quantity integer NOT NULL,
  fulfilled_quantity integer NOT NULL DEFAULT 0,
  released_quantity integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  cancelled_by uuid,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_product_tenant_fk FOREIGN KEY (business_id, product_id)
    REFERENCES public.products (business_id, id) ON DELETE RESTRICT,
  CONSTRAINT reservations_operation_tenant_fk FOREIGN KEY (business_id, source_operation_id)
    REFERENCES public.inventory_reservation_operations (business_id, id) ON DELETE RESTRICT,
  CONSTRAINT reservations_operation_product_key UNIQUE (business_id, source_operation_id, product_id),
  CONSTRAINT reservations_quantities_check CHECK (
    original_quantity > 0 AND remaining_quantity >= 0
    AND fulfilled_quantity >= 0 AND released_quantity >= 0
    AND original_quantity::bigint = remaining_quantity::bigint
      + fulfilled_quantity::bigint + released_quantity::bigint
  ),
  CONSTRAINT reservations_cancellation_check CHECK (
    (cancelled_at IS NULL AND cancelled_by IS NULL)
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL
        AND remaining_quantity = 0 AND released_quantity > 0)
  ),
  CONSTRAINT reservations_completion_check CHECK (
    (remaining_quantity = 0 AND completed_at IS NOT NULL)
    OR (remaining_quantity > 0 AND completed_at IS NULL)
  )
);
GRANT SELECT ON public.inventory_reservations TO authenticated;
GRANT ALL ON public.inventory_reservations TO service_role;
REVOKE ALL ON public.inventory_reservations FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.inventory_reservations FROM authenticated;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservations_member_read ON public.inventory_reservations
  FOR SELECT TO authenticated USING (public.is_business_member(business_id, auth.uid()));
CREATE INDEX reservations_open_product_idx
  ON public.inventory_reservations (business_id, product_id) WHERE remaining_quantity > 0;
CREATE INDEX reservations_business_created_idx
  ON public.inventory_reservations (business_id, created_at DESC);

CREATE FUNCTION public.task1a_reservation_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Reservation history cannot be deleted; release remaining balance instead';
  END IF;
  v_actor := NEW.updated_by;
  IF auth.uid() IS NOT NULL AND v_actor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Reservation actor must be authenticated caller' USING ERRCODE = '42501';
  END IF;
  IF public.is_business_member(NEW.business_id, v_actor) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Reservation actor is not a business member' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_actor OR NEW.remaining_quantity <> NEW.original_quantity
       OR NEW.fulfilled_quantity <> 0 OR NEW.released_quantity <> 0
       OR NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by IS NOT NULL THEN
      RAISE EXCEPTION 'Reservation must start fully open with matching creator';
    END IF;
    NEW.created_at := now();
    NEW.completed_at := NULL;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.source_operation_id IS DISTINCT FROM OLD.source_operation_id
       OR NEW.original_quantity IS DISTINCT FROM OLD.original_quantity
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Reservation identity, source and original quantity are immutable';
    END IF;
    IF OLD.remaining_quantity = 0 THEN RAISE EXCEPTION 'Closed reservation is immutable'; END IF;
    IF NEW.fulfilled_quantity < OLD.fulfilled_quantity
       OR NEW.released_quantity < OLD.released_quantity
       OR NEW.remaining_quantity > OLD.remaining_quantity THEN
      RAISE EXCEPTION 'Reservation balances cannot be rewound';
    END IF;
    IF NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by IS NOT NULL THEN
      IF NEW.remaining_quantity <> 0 OR NEW.cancelled_by IS DISTINCT FROM v_actor
         OR NEW.fulfilled_quantity <> OLD.fulfilled_quantity
         OR NEW.released_quantity::bigint <> OLD.released_quantity::bigint + OLD.remaining_quantity::bigint THEN
        RAISE EXCEPTION 'Cancellation must release exactly the remaining balance';
      END IF;
      NEW.cancelled_at := now();
    END IF;
    NEW.completed_at := CASE WHEN NEW.remaining_quantity = 0 THEN now() ELSE NULL END;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.task1a_reservation_validate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_task1a_reservation_validate
  BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.task1a_reservation_validate();

COMMENT ON TABLE public.employees IS
  'Business-scoped employee attribution identity, not an auth user or permission role. Deactivate instead of deleting. No sales history links are introduced in Task 1A.';
COMMENT ON TABLE public.inventory_reservation_operations IS
  'Tenant-bound reservation source identity. External reference is provenance only, not a claim of relational integrity with any future domain table.';
COMMENT ON TABLE public.inventory_reservations IS
  'Dormant additive reservation model. Partial fulfillment and release allowed; original = remaining + fulfilled + released. Future atomic RPCs and event ledger required before activation.';
-- No grants/revokes on existing products, inventory_actions or existing RPCs.
-- Reserved-column trigger compensates for existing table-level product grants.
-- No aggregate synchronization trigger: reservation writes remain operationally
-- disabled until the separately approved atomic mutation/cutover phase.
COMMIT;