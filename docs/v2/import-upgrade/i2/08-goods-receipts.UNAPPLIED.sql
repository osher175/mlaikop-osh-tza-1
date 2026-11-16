-- UNAPPLIED. Do not execute until a separate approval.
-- Shared receipt contract for a future engine. Posting is rejected.
-- Does not alter import_receipt_confirm, post_purchase_receipt, products, or inventory_lots.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id),
  import_order_id uuid,
  purchase_order_id uuid,
  status text NOT NULL DEFAULT 'draft',
  idempotency_key uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  receiving_date date,
  notes text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_goods_receipts_import_fkey
    FOREIGN KEY (business_id, import_order_id)
    REFERENCES public.import_orders (business_id, id),
  CONSTRAINT i2_goods_receipts_purchase_fkey
    FOREIGN KEY (business_id, purchase_order_id)
    REFERENCES public.purchase_orders (business_id, id),
  CONSTRAINT i2_goods_receipts_one_source_check
    CHECK (
      (import_order_id IS NOT NULL AND purchase_order_id IS NULL)
      OR (import_order_id IS NULL AND purchase_order_id IS NOT NULL)
    ),
  CONSTRAINT i2_goods_receipts_status_check
    CHECK (status IN ('draft', 'posted')),
  CONSTRAINT i2_goods_receipts_version_check
    CHECK (version >= 1),
  UNIQUE (business_id, idempotency_key)
);

CREATE UNIQUE INDEX i2_goods_receipts_business_id_id_key
  ON public.goods_receipts (business_id, id);

COMMENT ON TABLE public.goods_receipts IS
  'Future shared receipt. Existing import_receipts and purchase_receipts stay in place. A trigger rejects every status other than draft.';

CREATE TABLE public.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  goods_receipt_id uuid NOT NULL,
  source_type text NOT NULL,
  import_shipment_line_id uuid,
  import_order_item_id uuid,
  purchase_order_line_id uuid,
  ordered_quantity integer NOT NULL,
  previously_accepted integer NOT NULL DEFAULT 0,
  previously_damaged integer NOT NULL DEFAULT 0,
  previously_missing integer NOT NULL DEFAULT 0,
  accepted_quantity integer NOT NULL DEFAULT 0,
  damaged_quantity integer NOT NULL DEFAULT 0,
  missing_quantity integer NOT NULL DEFAULT 0,
  notes text,
  inventory_action_id uuid,
  cost_layer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_goods_receipt_lines_receipt_fkey
    FOREIGN KEY (business_id, goods_receipt_id)
    REFERENCES public.goods_receipts (business_id, id),
  CONSTRAINT i2_goods_receipt_lines_shipment_fkey
    FOREIGN KEY (business_id, import_shipment_line_id)
    REFERENCES public.import_shipment_lines (business_id, id),
  CONSTRAINT i2_goods_receipt_lines_import_item_fkey
    FOREIGN KEY (business_id, import_order_item_id)
    REFERENCES public.import_order_items (business_id, id),
  CONSTRAINT i2_goods_receipt_lines_purchase_line_fkey
    FOREIGN KEY (business_id, purchase_order_line_id)
    REFERENCES public.purchase_order_lines (business_id, id),
  CONSTRAINT i2_goods_receipt_lines_source_check
    CHECK (
      (
        source_type = 'import_shipment_line'
        AND import_shipment_line_id IS NOT NULL
        AND import_order_item_id IS NULL
        AND purchase_order_line_id IS NULL
      )
      OR (
        source_type = 'import_order_item'
        AND import_order_item_id IS NOT NULL
        AND import_shipment_line_id IS NULL
        AND purchase_order_line_id IS NULL
      )
      OR (
        source_type = 'purchase_order_line'
        AND purchase_order_line_id IS NOT NULL
        AND import_shipment_line_id IS NULL
        AND import_order_item_id IS NULL
      )
    ),
  CONSTRAINT i2_goods_receipt_lines_quantities_check
    CHECK (
      ordered_quantity >= 0
      AND accepted_quantity >= 0
      AND damaged_quantity >= 0
      AND missing_quantity >= 0
      AND previously_accepted >= 0
      AND previously_damaged >= 0
      AND previously_missing >= 0
      AND previously_accepted + previously_damaged + previously_missing <= ordered_quantity
      AND accepted_quantity + damaged_quantity + missing_quantity
          <= ordered_quantity - previously_accepted - previously_damaged - previously_missing
    )
);

COMMENT ON COLUMN public.goods_receipt_lines.previously_accepted IS
  'Checkpoint only. It must equal posted goods_receipt_lines for the same source. It is not an independent counter. Legacy import and purchase receipts are not copied into it.';
COMMENT ON COLUMN public.goods_receipt_lines.previously_damaged IS
  'Checkpoint only. It must equal posted goods_receipt_lines for the same source.';
COMMENT ON COLUMN public.goods_receipt_lines.previously_missing IS
  'Checkpoint only. It must equal posted goods_receipt_lines for the same source.';
COMMENT ON COLUMN public.goods_receipt_lines.inventory_action_id IS
  'Reserved reference. The posting block rejects a non-null value. No inventory row is written.';
COMMENT ON COLUMN public.goods_receipt_lines.cost_layer_id IS
  'Reserved for a future inventory_lots id. No foreign key is created. FIFO tables are not altered.';

CREATE TABLE public.goods_receipt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  goods_receipt_id uuid NOT NULL,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_goods_receipt_events_receipt_fkey
    FOREIGN KEY (business_id, goods_receipt_id)
    REFERENCES public.goods_receipts (business_id, id),
  CONSTRAINT i2_goods_receipt_events_type_check
    CHECK (length(btrim(event_type)) > 0)
);

CREATE OR REPLACE FUNCTION public.i2_goods_receipt_block_posting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft' OR NEW.posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'goods receipt posting is not activated' USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_goods_receipts_block_posting
  BEFORE INSERT OR UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.i2_goods_receipt_block_posting();

CREATE OR REPLACE FUNCTION public.i2_goods_receipt_line_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_import uuid;
  v_purchase uuid;
  v_line_order uuid;
  v_line_purchase uuid;
  v_prev_accepted integer;
  v_prev_damaged integer;
  v_prev_missing integer;
BEGIN
  IF NEW.inventory_action_id IS NOT NULL OR NEW.cost_layer_id IS NOT NULL THEN
    RAISE EXCEPTION 'goods receipt posting is not activated' USING ERRCODE = '0A000';
  END IF;

  SELECT import_order_id, purchase_order_id
    INTO v_import, v_purchase
  FROM public.goods_receipts
  WHERE id = NEW.goods_receipt_id
    AND business_id = NEW.business_id;
  IF v_import IS NULL AND v_purchase IS NULL THEN
    RAISE EXCEPTION 'goods receipt line has no parent' USING ERRCODE = '23514';
  END IF;

  IF v_import IS NOT NULL THEN
    IF NEW.purchase_order_line_id IS NOT NULL THEN
      RAISE EXCEPTION 'domestic line on an import receipt' USING ERRCODE = '23514';
    END IF;
    IF NEW.import_order_item_id IS NOT NULL THEN
      SELECT import_order_id INTO v_line_order
      FROM public.import_order_items
      WHERE id = NEW.import_order_item_id
        AND business_id = NEW.business_id;
      IF v_line_order IS DISTINCT FROM v_import THEN
        RAISE EXCEPTION 'import line is not on this receipt order' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.import_shipment_line_id IS NOT NULL THEN
      SELECT item.import_order_id INTO v_line_order
      FROM public.import_shipment_lines AS line
      JOIN public.import_order_items AS item
        ON item.id = line.import_order_item_id
       AND item.business_id = line.business_id
      WHERE line.id = NEW.import_shipment_line_id
        AND line.business_id = NEW.business_id;
      IF v_line_order IS DISTINCT FROM v_import THEN
        RAISE EXCEPTION 'shipment line is not on this receipt order' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSE
    IF NEW.import_order_item_id IS NOT NULL OR NEW.import_shipment_line_id IS NOT NULL THEN
      RAISE EXCEPTION 'import line on a domestic receipt' USING ERRCODE = '23514';
    END IF;
    SELECT purchase_order_id INTO v_line_purchase
    FROM public.purchase_order_lines
    WHERE id = NEW.purchase_order_line_id
      AND business_id = NEW.business_id;
    IF v_line_purchase IS DISTINCT FROM v_purchase THEN
      RAISE EXCEPTION 'purchase line is not on this receipt order' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.import_order_item_id IS NOT NULL THEN
    PERFORM 1 FROM public.import_order_items
    WHERE id = NEW.import_order_item_id AND business_id = NEW.business_id
    FOR UPDATE;
  ELSIF NEW.import_shipment_line_id IS NOT NULL THEN
    PERFORM 1 FROM public.import_shipment_lines
    WHERE id = NEW.import_shipment_line_id AND business_id = NEW.business_id
    FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.purchase_order_lines
    WHERE id = NEW.purchase_order_line_id AND business_id = NEW.business_id
    FOR UPDATE;
  END IF;

  PERFORM 1
  FROM public.goods_receipt_lines AS l
  JOIN public.goods_receipts AS r
    ON r.id = l.goods_receipt_id
   AND r.business_id = l.business_id
  WHERE r.business_id = NEW.business_id
    AND r.status = 'posted'
    AND l.id IS DISTINCT FROM NEW.id
    AND (
      (NEW.import_order_item_id IS NOT NULL AND l.import_order_item_id = NEW.import_order_item_id)
      OR (NEW.import_shipment_line_id IS NOT NULL AND l.import_shipment_line_id = NEW.import_shipment_line_id)
      OR (NEW.purchase_order_line_id IS NOT NULL AND l.purchase_order_line_id = NEW.purchase_order_line_id)
    )
  FOR UPDATE;

  SELECT
    COALESCE(SUM(l.accepted_quantity), 0),
    COALESCE(SUM(l.damaged_quantity), 0),
    COALESCE(SUM(l.missing_quantity), 0)
  INTO v_prev_accepted, v_prev_damaged, v_prev_missing
  FROM public.goods_receipt_lines AS l
  JOIN public.goods_receipts AS r
    ON r.id = l.goods_receipt_id
   AND r.business_id = l.business_id
  WHERE r.business_id = NEW.business_id
    AND r.status = 'posted'
    AND l.id IS DISTINCT FROM NEW.id
    AND (
      (NEW.import_order_item_id IS NOT NULL AND l.import_order_item_id = NEW.import_order_item_id)
      OR (NEW.import_shipment_line_id IS NOT NULL AND l.import_shipment_line_id = NEW.import_shipment_line_id)
      OR (NEW.purchase_order_line_id IS NOT NULL AND l.purchase_order_line_id = NEW.purchase_order_line_id)
    );
  IF NEW.previously_accepted IS DISTINCT FROM v_prev_accepted
     OR NEW.previously_damaged IS DISTINCT FROM v_prev_damaged
     OR NEW.previously_missing IS DISTINCT FROM v_prev_missing THEN
    RAISE EXCEPTION 'previously quantities must match posted receipt records' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER i2_goods_receipt_lines_guard
  BEFORE INSERT OR UPDATE ON public.goods_receipt_lines
  FOR EACH ROW EXECUTE FUNCTION public.i2_goods_receipt_line_guard();
CREATE TRIGGER i2_goods_receipt_events_append_only
  BEFORE UPDATE OR DELETE ON public.goods_receipt_events
  FOR EACH ROW EXECUTE FUNCTION public.i2_reject_append_only();

REVOKE ALL ON TABLE
  public.goods_receipts,
  public.goods_receipt_lines,
  public.goods_receipt_events
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.goods_receipts,
  public.goods_receipt_lines,
  public.goods_receipt_events
  TO authenticated;

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_events FORCE ROW LEVEL SECURITY;

CREATE POLICY i2_goods_receipts_select ON public.goods_receipts
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_goods_receipt_lines_select ON public.goods_receipt_lines
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_goods_receipt_events_select ON public.goods_receipt_events
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));

CREATE OR REPLACE FUNCTION public.save_goods_receipt_draft(
  p_business_id uuid,
  p_idempotency_key uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_idempotency_key IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid goods receipt draft' USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'goods receipt writing is not activated' USING ERRCODE = '0A000';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.post_goods_receipt(
  p_business_id uuid,
  p_receipt_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_receipt_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid goods receipt post' USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NULL
     OR public.is_business_member(p_business_id, auth.uid()) IS DISTINCT FROM true
     OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'goods receipt posting is not activated' USING ERRCODE = '0A000';
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_goods_receipt_draft(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.post_goods_receipt(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_goods_receipt_block_posting()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.i2_goods_receipt_line_guard()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.post_goods_receipt(uuid, uuid, uuid) IS
  'Reserved posting signature. Revoked. The body refuses before any stock write. Domestic receipt permission is not granted by this file.';

COMMIT;
