-- UNAPPLIED. Do not execute until a separate approval.
-- Adds commercial state beside the existing logistics status.
-- Does not rewrite status, import_number, dates, or historical rows.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.import_orders
  ADD COLUMN commercial_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmed_by uuid,
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN actual_arrival_on date,
  ADD COLUMN payment_state text,
  ADD COLUMN shipment_state text,
  ADD COLUMN receiving_state text;

ALTER TABLE public.import_orders
  ADD CONSTRAINT i2_import_orders_commercial_status_check
    CHECK (commercial_status IN ('draft', 'confirmed')),
  ADD CONSTRAINT i2_import_orders_version_check
    CHECK (version >= 1),
  ADD CONSTRAINT i2_import_orders_payment_state_check
    CHECK (payment_state IS NULL OR payment_state IN ('unpaid', 'partial', 'paid')),
  ADD CONSTRAINT i2_import_orders_shipment_state_check
    CHECK (shipment_state IS NULL OR shipment_state IN ('none', 'in_progress', 'arrived')),
  ADD CONSTRAINT i2_import_orders_receiving_state_check
    CHECK (receiving_state IS NULL OR receiving_state IN ('none', 'draft', 'partial', 'complete'));

COMMENT ON COLUMN public.import_orders.commercial_status IS
  'draft or confirmed. Existing and current live inserts receive confirmed because they are born ordered. confirmed_at stays null until a future confirmed write records it. Logistics status is a different column.';
COMMENT ON COLUMN public.import_orders.version IS
  'Optimistic concurrency counter for a future commercial RPC. Legacy direct updates are not blocked and do not bump this value.';
COMMENT ON COLUMN public.import_orders.payment_state IS
  'Independent of logistics status and of shipment_state. Null means unclassified. This migration does not derive it.';
COMMENT ON COLUMN public.import_orders.shipment_state IS
  'Independent of payment_state and receiving_state. Null means unclassified.';
COMMENT ON COLUMN public.import_orders.receiving_state IS
  'Independent of logistics status. Null means unclassified. This does not post inventory.';
COMMENT ON COLUMN public.import_orders.actual_arrival_on IS
  'Actual arrival date when a user records one. estimated_arrival_date is not copied here.';

CREATE TABLE public.import_order_term_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  import_order_id uuid NOT NULL,
  version integer NOT NULL,
  supplier_id uuid,
  currency_code text NOT NULL,
  lines jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_order_term_snapshots_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id),
  CONSTRAINT i2_import_order_term_snapshots_version_check
    CHECK (version >= 1),
  CONSTRAINT i2_import_order_term_snapshots_currency_check
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT i2_import_order_term_snapshots_lines_check
    CHECK (jsonb_typeof(lines) = 'array'),
  UNIQUE (business_id, import_order_id, version)
);

COMMENT ON TABLE public.import_order_term_snapshots IS
  'Append-only commercial terms. lines entries are quantity, supplier unit cost, and currency. No snapshot is created for historical orders.';

CREATE TABLE public.import_commercial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  import_order_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  from_version integer,
  to_version integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_commercial_events_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id),
  CONSTRAINT i2_import_commercial_events_status_check
    CHECK (
      (from_status IS NULL OR from_status IN ('draft', 'confirmed'))
      AND to_status IN ('draft', 'confirmed')
    )
);

COMMENT ON TABLE public.import_commercial_events IS
  'Append-only commercial transitions. Actor is auth.uid() inside a future RPC. The client has no write grant. Historical orders get no reconstructed events.';

CREATE OR REPLACE FUNCTION public.i2_reject_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION 'this import-upgrade record is append-only' USING ERRCODE = '0A000';
END;
$fn$;

CREATE TRIGGER i2_import_order_term_snapshots_append_only
  BEFORE UPDATE OR DELETE ON public.import_order_term_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.i2_reject_append_only();
CREATE TRIGGER i2_import_commercial_events_append_only
  BEFORE UPDATE OR DELETE ON public.import_commercial_events
  FOR EACH ROW EXECUTE FUNCTION public.i2_reject_append_only();

REVOKE ALL ON TABLE
  public.import_order_term_snapshots,
  public.import_commercial_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.import_order_term_snapshots,
  public.import_commercial_events
  TO authenticated;

ALTER TABLE public.import_order_term_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_order_term_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_commercial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_commercial_events FORCE ROW LEVEL SECURITY;

CREATE POLICY i2_import_order_term_snapshots_select
  ON public.import_order_term_snapshots
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_commercial_events_select
  ON public.import_commercial_events
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));

-- Signature reserved for I3. The body refuses every call. No execute grant.
CREATE OR REPLACE FUNCTION public.save_import_commercial_terms(
  p_business_id uuid,
  p_order_id uuid,
  p_expected_version integer,
  p_confirm boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_confirm IS NULL
     OR p_order_id IS NULL
     OR p_expected_version IS NULL
     OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'invalid commercial save' USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'import commercial writes are not activated' USING ERRCODE = '0A000';
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_import_commercial_terms(uuid, uuid, integer, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_reject_append_only()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.save_import_commercial_terms(uuid, uuid, integer, boolean) IS
  'I3 will write drafts and confirmations here. I2 keeps it revoked. It does not accept a caller-supplied user id.';

COMMIT;
