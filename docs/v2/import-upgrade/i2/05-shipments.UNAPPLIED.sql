-- UNAPPLIED. Do not execute until a separate approval.
-- Shipments and containers. No copy of estimated_arrival_date.
-- No merge of two orders into one line.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id),
  shipment_number text NOT NULL,
  tracking_reference text,
  logistics_status text NOT NULL DEFAULT 'preparing',
  expected_departure_on date,
  actual_departure_on date,
  expected_port_arrival_on date,
  actual_port_arrival_on date,
  expected_warehouse_on date,
  actual_warehouse_on date,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_shipments_number_key UNIQUE (business_id, shipment_number),
  CONSTRAINT i2_import_shipments_number_check
    CHECK (length(btrim(shipment_number)) > 0),
  CONSTRAINT i2_import_shipments_version_check
    CHECK (version >= 1),
  CONSTRAINT i2_import_shipments_status_check
    CHECK (logistics_status IN (
      'preparing', 'ready_to_ship', 'departed', 'in_transit', 'arrived_port',
      'customs_clearance', 'inland_transport', 'arrived_warehouse', 'cancelled'
    ))
);

CREATE UNIQUE INDEX i2_import_shipments_business_id_id_key
  ON public.import_shipments (business_id, id);

COMMENT ON TABLE public.import_shipments IS
  'Physical movement. Dates stay null until recorded. Order ETA is not copied. Logistics status does not open receiving.';

CREATE TABLE public.import_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  container_number text NOT NULL,
  tracking_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_containers_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_containers_number_key
    UNIQUE (business_id, shipment_id, container_number),
  CONSTRAINT i2_import_containers_number_check
    CHECK (length(btrim(container_number)) > 0)
);

CREATE UNIQUE INDEX i2_import_containers_business_id_id_key
  ON public.import_containers (business_id, id);

COMMENT ON TABLE public.import_containers IS
  'A shipment may have several containers. A container may carry lines from several orders through import_container_orders.';

CREATE TABLE public.import_shipment_orders (
  business_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  import_order_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_shipment_orders_pkey PRIMARY KEY (shipment_id, import_order_id),
  CONSTRAINT i2_import_shipment_orders_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_shipment_orders_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id)
);

CREATE TABLE public.import_container_orders (
  business_id uuid NOT NULL,
  container_id uuid NOT NULL,
  import_order_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_container_orders_pkey PRIMARY KEY (container_id, import_order_id),
  CONSTRAINT i2_import_container_orders_container_fkey
    FOREIGN KEY (business_id, container_id)
    REFERENCES public.import_containers (business_id, id),
  CONSTRAINT i2_import_container_orders_order_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id)
);

CREATE TABLE public.import_shipment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  container_id uuid,
  import_order_item_id uuid NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_shipment_lines_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_shipment_lines_container_fkey
    FOREIGN KEY (business_id, container_id)
    REFERENCES public.import_containers (business_id, id),
  CONSTRAINT i2_import_shipment_lines_item_fkey
    FOREIGN KEY (business_id, import_order_item_id)
    REFERENCES public.import_order_items (business_id, id),
  CONSTRAINT i2_import_shipment_lines_quantity_check
    CHECK (quantity > 0)
);

CREATE UNIQUE INDEX i2_import_shipment_lines_business_id_id_key
  ON public.import_shipment_lines (business_id, id);

COMMENT ON TABLE public.import_shipment_lines IS
  'Quantity of one order line on one shipment. Two orders are never stored as one line.';

CREATE TABLE public.import_shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  milestone text NOT NULL,
  from_status text,
  to_status text,
  planned_on date,
  actual_on date,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_import_shipment_events_shipment_fkey
    FOREIGN KEY (business_id, shipment_id)
    REFERENCES public.import_shipments (business_id, id),
  CONSTRAINT i2_import_shipment_events_milestone_check
    CHECK (milestone IN ('departure', 'port_arrival', 'warehouse', 'logistics_status'))
);

COMMENT ON TABLE public.import_shipment_events IS
  'Append-only milestone corrections. A correction is a new row. Order ETA is not backfilled into these dates.';

CREATE OR REPLACE FUNCTION public.i2_container_order_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_shipment uuid;
BEGIN
  SELECT shipment_id INTO v_shipment
  FROM public.import_containers
  WHERE id = NEW.container_id
    AND business_id = NEW.business_id;
  IF v_shipment IS NULL THEN
    RAISE EXCEPTION 'container belongs to a different business' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.import_shipment_orders
    WHERE shipment_id = v_shipment
      AND import_order_id = NEW.import_order_id
      AND business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'container order is not linked to the parent shipment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_import_container_orders_guard
  BEFORE INSERT OR UPDATE ON public.import_container_orders
  FOR EACH ROW EXECUTE FUNCTION public.i2_container_order_guard();

CREATE OR REPLACE FUNCTION public.i2_shipment_line_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_order uuid;
  v_ordered integer;
  v_not_arriving integer;
  v_allocated integer;
  v_container_shipment uuid;
  v_item uuid;
  v_business uuid;
BEGIN
  -- Lock the order line for the rest of the transaction. Concurrent shipment
  -- writers and deletes queue on the same row, then re-read the sum.
  v_item := COALESCE(NEW.import_order_item_id, OLD.import_order_item_id);
  v_business := COALESCE(NEW.business_id, OLD.business_id);
  PERFORM 1
  FROM public.import_order_items
  WHERE id = v_item
    AND business_id = v_business
  FOR UPDATE;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  PERFORM 1
  FROM public.import_shipment_lines
  WHERE import_order_item_id = v_item
    AND business_id = v_business
    AND id IS DISTINCT FROM NEW.id
  FOR UPDATE;
  SELECT import_order_id, ordered_quantity, not_arriving_quantity
    INTO v_order, v_ordered, v_not_arriving
  FROM public.import_order_items
  WHERE id = v_item
    AND business_id = v_business;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'order line belongs to a different business' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.import_shipment_orders
    WHERE shipment_id = NEW.shipment_id
      AND import_order_id = v_order
      AND business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'shipment line order is not linked to this shipment' USING ERRCODE = '23514';
  END IF;
  IF NEW.container_id IS NOT NULL THEN
    SELECT shipment_id INTO v_container_shipment
    FROM public.import_containers
    WHERE id = NEW.container_id
      AND business_id = NEW.business_id;
    IF v_container_shipment IS DISTINCT FROM NEW.shipment_id THEN
      RAISE EXCEPTION 'container is not on this shipment' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.import_container_orders
      WHERE container_id = NEW.container_id
        AND import_order_id = v_order
        AND business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'order is not linked to this container' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO v_allocated
  FROM public.import_shipment_lines
  WHERE import_order_item_id = NEW.import_order_item_id
    AND business_id = NEW.business_id
    AND id IS DISTINCT FROM NEW.id;
  IF v_allocated + NEW.quantity > v_ordered - v_not_arriving THEN
    RAISE EXCEPTION 'shipment quantity exceeds remaining ordered quantity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_import_shipment_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.import_shipment_lines
  FOR EACH ROW EXECUTE FUNCTION public.i2_shipment_line_guard();

CREATE TRIGGER i2_import_shipment_events_append_only
  BEFORE UPDATE OR DELETE ON public.import_shipment_events
  FOR EACH ROW EXECUTE FUNCTION public.i2_reject_append_only();

REVOKE ALL ON TABLE
  public.import_shipments,
  public.import_containers,
  public.import_shipment_orders,
  public.import_container_orders,
  public.import_shipment_lines,
  public.import_shipment_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.import_shipments,
  public.import_containers,
  public.import_shipment_orders,
  public.import_container_orders,
  public.import_shipment_lines,
  public.import_shipment_events
  TO authenticated;

ALTER TABLE public.import_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_containers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_container_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_container_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_events FORCE ROW LEVEL SECURITY;

CREATE POLICY i2_import_shipments_select ON public.import_shipments
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_containers_select ON public.import_containers
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_shipment_orders_select ON public.import_shipment_orders
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_container_orders_select ON public.import_container_orders
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_shipment_lines_select ON public.import_shipment_lines
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_import_shipment_events_select ON public.import_shipment_events
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));

CREATE OR REPLACE FUNCTION public.record_import_shipment_event(
  p_business_id uuid,
  p_shipment_id uuid,
  p_milestone text,
  p_to_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_shipment_id IS NULL OR p_milestone IS NULL THEN
    RAISE EXCEPTION 'invalid shipment event' USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'import shipment writes are not activated' USING ERRCODE = '0A000';
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_import_shipment_event(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_container_order_guard()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_shipment_line_guard()
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
