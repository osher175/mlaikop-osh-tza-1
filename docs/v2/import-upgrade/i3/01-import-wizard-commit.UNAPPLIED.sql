-- UNAPPLIED. Do not run on production until a separate approval.
-- Import supplier classification, business-scoped tire identity, and one
-- transactional wizard commit. Does not post stock and does not depend on I2.
--
-- Apply only after docs/v2/import-upgrade/i3/02-preflight.readonly.sql passes.
-- Safe order: this file stands alone. I2 may be applied before or after it.
-- I2 product_tire_specs is a different table and is not written here.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS serves_import boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS serves_local boolean NOT NULL DEFAULT true;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_serves_a_channel;
ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_serves_a_channel
  CHECK (serves_import OR serves_local);

COMMENT ON COLUMN public.suppliers.serves_import IS
  'Import wizard and import_wizard_commit accept the supplier only when this is true. Existing rows stay false.';
COMMENT ON COLUMN public.suppliers.serves_local IS
  'Local purchasing writes accept the supplier only when this is true. Existing rows stay true.';

ALTER TABLE public.import_orders
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS client_request_payload jsonb;

ALTER TABLE public.import_order_items
  ADD COLUMN IF NOT EXISTS load_index integer,
  ADD COLUMN IF NOT EXISTS speed_rating text;

ALTER TABLE public.import_order_items
  DROP CONSTRAINT IF EXISTS import_order_items_load_index_range;
ALTER TABLE public.import_order_items
  ADD CONSTRAINT import_order_items_load_index_range
  CHECK (load_index IS NULL OR (load_index BETWEEN 1 AND 279));

ALTER TABLE public.import_order_items
  DROP CONSTRAINT IF EXISTS import_order_items_speed_rating_check;
ALTER TABLE public.import_order_items
  ADD CONSTRAINT import_order_items_speed_rating_check
  CHECK (speed_rating IS NULL OR speed_rating ~ '^[A-Z]{1,2}$');

COMMENT ON COLUMN public.import_order_items.load_index IS
  'Numeric load code, stored apart from speed_rating. Existing rows stay null. A new wizard tire requires a value from 1 to 279.';
COMMENT ON COLUMN public.import_order_items.speed_rating IS
  'Speed code, stored apart from load_index. Empty stays null.';

CREATE UNIQUE INDEX IF NOT EXISTS import_orders_client_request_key
  ON public.import_orders (business_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.import_orders.client_request_id IS
  'One wizard submission. A retry with the same id returns the original order and does not create another.';

CREATE TABLE IF NOT EXISTS public.import_tire_identity (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  model_name text NOT NULL,
  width_mm integer NOT NULL CHECK (width_mm > 0),
  aspect_ratio integer NOT NULL CHECK (aspect_ratio > 0),
  rim_inch numeric(4,1) NOT NULL CHECK (rim_inch > 0),
  load_index integer CHECK (load_index IS NULL OR (load_index BETWEEN 1 AND 279)),
  speed_rating text CHECK (speed_rating IS NULL OR speed_rating ~ '^[A-Z]{1,2}$'),
  sku text,
  identity_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, identity_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS import_tire_identity_sku_key
  ON public.import_tire_identity (business_id, lower(btrim(sku)))
  WHERE sku IS NOT NULL AND length(btrim(sku)) > 0;

COMMENT ON TABLE public.import_tire_identity IS
  'Identity for tires created or linked by import_wizard_commit. Not a stock balance and not a second catalog. A legacy product is linked only from one unambiguous purchase-order line that already stores brand, model, size, load, and speed. A product name is not evidence.';

ALTER TABLE public.import_tire_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_tire_identity FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_tire_identity_manager ON public.import_tire_identity;
CREATE POLICY import_tire_identity_manager ON public.import_tire_identity
  FOR ALL TO authenticated
  USING (public.can_manage_business_imports(business_id, auth.uid()))
  WITH CHECK (public.can_manage_business_imports(business_id, auth.uid()));

REVOKE ALL ON TABLE public.import_tire_identity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.import_tire_identity TO authenticated;

CREATE OR REPLACE FUNCTION public.import_tire_identity_same_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_business uuid;
BEGIN
  SELECT business_id INTO v_business FROM public.products WHERE id = NEW.product_id;
  IF v_business IS DISTINCT FROM NEW.business_id THEN
    RAISE EXCEPTION 'Product belongs to a different business' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.import_tire_identity_same_business() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS import_tire_identity_same_business ON public.import_tire_identity;
CREATE TRIGGER import_tire_identity_same_business
  BEFORE INSERT OR UPDATE ON public.import_tire_identity
  FOR EACH ROW
  EXECUTE FUNCTION public.import_tire_identity_same_business();

-- Local purchasing writes. Import orders are not in this trigger.
-- DEFINER so the flag can be checked when the caller cannot list suppliers.
-- The function only rejects; it does not return supplier data.
CREATE OR REPLACE FUNCTION public.reject_import_only_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_business uuid;
  v_supplier_business uuid;
  v_local boolean;
BEGIN
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'supplier_quotes' THEN
    SELECT business_id INTO v_business
    FROM public.procurement_requests
    WHERE id = NEW.procurement_request_id;
  ELSE
    v_business := NEW.business_id;
  END IF;

  SELECT business_id, serves_local
    INTO v_supplier_business, v_local
  FROM public.suppliers
  WHERE id = NEW.supplier_id;

  IF v_supplier_business IS DISTINCT FROM v_business OR v_local IS NOT TRUE THEN
    RAISE EXCEPTION 'Supplier is not available for local purchasing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_import_only_supplier() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inventory_actions_local_supplier ON public.inventory_actions;
CREATE TRIGGER inventory_actions_local_supplier
  BEFORE INSERT OR UPDATE OF supplier_id ON public.inventory_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_import_only_supplier();

DROP TRIGGER IF EXISTS supplier_quotes_local_supplier ON public.supplier_quotes;
CREATE TRIGGER supplier_quotes_local_supplier
  BEFORE INSERT OR UPDATE OF supplier_id ON public.supplier_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_import_only_supplier();

DROP TRIGGER IF EXISTS supplier_preferences_local_supplier ON public.supplier_preferences;
CREATE TRIGGER supplier_preferences_local_supplier
  BEFORE INSERT OR UPDATE OF supplier_id ON public.supplier_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_import_only_supplier();

DO $purchase_orders$
BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'purchase_orders'
         AND column_name = 'supplier_id'
     )
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'purchase_orders'
         AND column_name = 'business_id'
     ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS purchase_orders_local_supplier ON public.purchase_orders';
    EXECUTE 'CREATE TRIGGER purchase_orders_local_supplier BEFORE INSERT OR UPDATE OF supplier_id ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.reject_import_only_supplier()';
  END IF;
END;
$purchase_orders$;

CREATE OR REPLACE FUNCTION public.import_wizard_commit(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_business uuid;
  v_supplier uuid;
  v_order uuid;
  v_request uuid;
  v_stored jsonb;
  v_line jsonb;
  v_product uuid;
  v_sku_product uuid;
  v_key_product uuid;
  v_sku_key text;
  v_key text;
  v_brand text;
  v_model text;
  v_sku text;
  v_width integer;
  v_aspect integer;
  v_rim numeric(4,1);
  v_load integer;
  v_speed text;
  v_size text;
  v_description text;
  v_quantity integer;
  v_cost numeric;
  v_sale numeric;
  v_country text;
  v_name text;
  v_name_count integer;
  v_same_country integer;
  v_legacy_count integer;
  v_replayed boolean := false;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Import payload is incomplete';
  END IF;

  IF COALESCE(p_payload->>'business_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_business := (p_payload->>'business_id')::uuid;
  IF NOT public.is_business_member(v_business, auth.uid())
     OR NOT public.can_manage_business_imports(v_business, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_payload->>'client_request_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Import request id is missing';
  END IF;
  v_request := (p_payload->>'client_request_id')::uuid;

  IF p_payload->>'purchase_type' NOT IN ('direct_import', 'parallel_import') THEN
    RAISE EXCEPTION 'Purchase type is not supported';
  END IF;
  IF p_payload->>'currency_code' NOT IN ('ILS', 'USD', 'EUR', 'CNY', 'GBP', 'JPY', 'TRY') THEN
    RAISE EXCEPTION 'Currency is not supported';
  END IF;
  IF COALESCE(p_payload->>'order_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Order date is invalid';
  END IF;
  IF NULLIF(p_payload->>'estimated_arrival_date', '') IS NOT NULL
     AND p_payload->>'estimated_arrival_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Arrival date is invalid';
  END IF;
  IF NULLIF(p_payload->>'working_exchange_rate_to_ils', '') IS NOT NULL
     AND (
       p_payload->>'working_exchange_rate_to_ils' !~ '^[0-9]+(\.[0-9]+)?$'
       OR (p_payload->>'working_exchange_rate_to_ils')::numeric <= 0
     ) THEN
    RAISE EXCEPTION 'Working rate must be positive or empty';
  END IF;
  IF jsonb_typeof(p_payload->'lines') <> 'array'
     OR jsonb_array_length(p_payload->'lines') < 1
     OR jsonb_array_length(p_payload->'lines') > 100 THEN
    RAISE EXCEPTION 'At least one product line is required';
  END IF;

  -- Validate every line before any supplier, product, or order write.
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    IF COALESCE(v_line->>'ordered_quantity', '') !~ '^[0-9]+$'
       OR (v_line->>'ordered_quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'Ordered quantity must be a positive integer';
    END IF;
    IF COALESCE(v_line->>'supplier_unit_cost', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Supplier unit cost is required';
    END IF;
    IF NULLIF(v_line->>'planned_sale_price_ils', '') IS NOT NULL
       AND v_line->>'planned_sale_price_ils' !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'Planned sale price is invalid';
    END IF;
    IF NULLIF(v_line->>'product_id', '') IS NULL THEN
      IF length(btrim(COALESCE(v_line->>'brand', ''))) = 0
         OR length(btrim(COALESCE(v_line->>'model', ''))) = 0 THEN
        RAISE EXCEPTION 'Tire brand and model are required';
      END IF;
      IF COALESCE(v_line->>'width', '') !~ '^[0-9]+$' OR (v_line->>'width')::integer <= 0
         OR COALESCE(v_line->>'aspect', '') !~ '^[0-9]+$' OR (v_line->>'aspect')::integer <= 0
         OR COALESCE(v_line->>'rim', '') !~ '^[0-9]+(\.[0-9]+)?$' OR (v_line->>'rim')::numeric <= 0 THEN
        RAISE EXCEPTION 'Tire size is incomplete';
      END IF;
      IF COALESCE(v_line->>'load_index', '') !~ '^[1-9][0-9]{0,2}$'
         OR (v_line->>'load_index')::integer > 279 THEN
        RAISE EXCEPTION 'Load code is required';
      END IF;
      IF NULLIF(btrim(COALESCE(v_line->>'speed_rating', '')), '') IS NOT NULL
         AND upper(btrim(v_line->>'speed_rating')) !~ '^[A-Z]{1,2}$' THEN
        RAISE EXCEPTION 'Speed rating is invalid';
      END IF;
    ELSIF v_line->>'product_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Product belongs to a different business';
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_business::text || '|import-request|' || v_request::text, 0));
  SELECT id, client_request_payload
    INTO v_order, v_stored
  FROM public.import_orders
  WHERE business_id = v_business
    AND client_request_id = v_request;
  IF v_order IS NOT NULL THEN
    IF v_stored IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'Import request id was already used';
    END IF;
    RETURN jsonb_build_object('id', v_order, 'replayed', true);
  END IF;

  IF NULLIF(p_payload->>'supplier_id', '') IS NOT NULL THEN
    IF p_payload->>'supplier_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Supplier is not available for import' USING ERRCODE = '42501';
    END IF;
    SELECT id, country INTO v_supplier, v_country
    FROM public.suppliers
    WHERE id = (p_payload->>'supplier_id')::uuid
      AND business_id = v_business
      AND serves_import = true;
    IF v_supplier IS NULL THEN
      RAISE EXCEPTION 'Supplier is not available for import' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_name := btrim(COALESCE(p_payload->'new_supplier'->>'name', ''));
    v_country := btrim(COALESCE(p_payload->'new_supplier'->>'country', ''));
    IF length(v_name) = 0 OR length(v_country) = 0 OR length(v_name) > 200 OR length(v_country) > 80 THEN
      RAISE EXCEPTION 'Import supplier name and country are required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_business::text || '|supplier|' || lower(v_name), 0));
    SELECT count(*) INTO v_name_count
    FROM public.suppliers
    WHERE business_id = v_business
      AND lower(btrim(name)) = lower(v_name);
    SELECT count(*) INTO v_same_country
    FROM public.suppliers
    WHERE business_id = v_business
      AND lower(btrim(name)) = lower(v_name)
      AND lower(btrim(COALESCE(country, ''))) = lower(v_country);
    IF v_same_country > 1 OR (v_same_country = 0 AND v_name_count > 1) THEN
      RAISE EXCEPTION 'Ambiguous supplier name';
    END IF;
    IF v_same_country = 1 THEN
      SELECT id INTO v_supplier
      FROM public.suppliers
      WHERE business_id = v_business
        AND lower(btrim(name)) = lower(v_name)
        AND lower(btrim(COALESCE(country, ''))) = lower(v_country);
      UPDATE public.suppliers
        SET serves_import = true
        WHERE id = v_supplier
          AND serves_import = false;
    ELSIF v_name_count = 1 THEN
      SELECT id INTO v_supplier
      FROM public.suppliers
      WHERE business_id = v_business
        AND lower(btrim(name)) = lower(v_name)
        AND country IS NULL;
      IF v_supplier IS NULL THEN
        INSERT INTO public.suppliers (
          business_id, name, country, phone, contact_email, sales_agent_name, serves_import, serves_local
        ) VALUES (
          v_business,
          v_name,
          v_country,
          NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'phone', '')), ''),
          NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'email', '')), ''),
          NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'contact_name', '')), ''),
          true,
          false
        )
        RETURNING id INTO v_supplier;
      ELSE
        UPDATE public.suppliers
          SET serves_import = true,
              country = v_country
          WHERE id = v_supplier
            AND country IS NULL;
      END IF;
    ELSE
      INSERT INTO public.suppliers (
        business_id, name, country, phone, contact_email, sales_agent_name, serves_import, serves_local
      ) VALUES (
        v_business,
        v_name,
        v_country,
        NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'phone', '')), ''),
        NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'email', '')), ''),
        NULLIF(btrim(COALESCE(p_payload->'new_supplier'->>'contact_name', '')), ''),
        true,
        false
      )
      RETURNING id INTO v_supplier;
    END IF;
  END IF;

  INSERT INTO public.import_orders (
    business_id, supplier_id, purchase_type, supplier_country, currency_code,
    working_exchange_rate_to_ils, order_date, estimated_arrival_date,
    supplier_order_reference, notes, client_request_id, client_request_payload
  ) VALUES (
    v_business,
    v_supplier,
    p_payload->>'purchase_type',
    NULLIF(v_country, ''),
    p_payload->>'currency_code',
    NULLIF(p_payload->>'working_exchange_rate_to_ils', '')::numeric,
    (p_payload->>'order_date')::date,
    NULLIF(p_payload->>'estimated_arrival_date', '')::date,
    NULLIF(btrim(COALESCE(p_payload->>'supplier_order_reference', '')), ''),
    NULLIF(btrim(COALESCE(p_payload->>'notes', '')), ''),
    v_request,
    p_payload
  )
  RETURNING id INTO v_order;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    v_size := NULL;
    v_load := NULL;
    v_speed := NULL;
    v_quantity := (v_line->>'ordered_quantity')::integer;
    v_cost := (v_line->>'supplier_unit_cost')::numeric;
    v_sale := NULLIF(v_line->>'planned_sale_price_ils', '')::numeric;
    v_product := NULLIF(v_line->>'product_id', '')::uuid;

    IF v_product IS NOT NULL THEN
      PERFORM 1 FROM public.products WHERE id = v_product AND business_id = v_business;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product belongs to a different business';
      END IF;
      v_description := btrim(COALESCE(v_line->>'description', ''));
      IF length(v_description) = 0 THEN
        RAISE EXCEPTION 'Product description is required';
      END IF;
      IF NULLIF(v_line->>'load_index', '') IS NOT NULL THEN
        IF v_line->>'load_index' !~ '^[1-9][0-9]{0,2}$' OR (v_line->>'load_index')::integer > 279 THEN
          RAISE EXCEPTION 'Load code is required';
        END IF;
        v_load := (v_line->>'load_index')::integer;
      END IF;
      IF NULLIF(btrim(COALESCE(v_line->>'speed_rating', '')), '') IS NOT NULL THEN
        v_speed := upper(btrim(v_line->>'speed_rating'));
        IF v_speed !~ '^[A-Z]{1,2}$' THEN
          RAISE EXCEPTION 'Speed rating is invalid';
        END IF;
      END IF;
    ELSE
      v_brand := btrim(v_line->>'brand');
      v_model := btrim(v_line->>'model');
      v_sku := NULLIF(btrim(COALESCE(v_line->>'sku', '')), '');
      v_width := (v_line->>'width')::integer;
      v_aspect := (v_line->>'aspect')::integer;
      v_rim := round((v_line->>'rim')::numeric, 1);
      IF v_rim >= 1000 THEN
        RAISE EXCEPTION 'Tire size is incomplete';
      END IF;
      v_load := (v_line->>'load_index')::integer;
      IF v_load < 1 OR v_load > 279 THEN
        RAISE EXCEPTION 'Load code is required';
      END IF;
      v_speed := NULLIF(upper(btrim(COALESCE(v_line->>'speed_rating', ''))), '');
      v_size := v_width::text || '/' || v_aspect::text || 'R' ||
        CASE WHEN v_rim = trunc(v_rim) THEN trunc(v_rim)::integer::text ELSE to_char(v_rim, 'FM990.0') END
        || ' ' || v_load::text || COALESCE(v_speed, '');
      v_key := regexp_replace(lower(v_brand), '\s+', ' ', 'g') || '|' ||
        regexp_replace(lower(v_model), '\s+', ' ', 'g') || '|' ||
        v_width::text || '|' || v_aspect::text || '|' || to_char(v_rim, 'FM990.0') || '|' ||
        COALESCE(v_load::text, '') || '|' || COALESCE(v_speed, '');
      v_description := v_brand || ' ' || v_model || ' ' || v_size;

      PERFORM pg_advisory_xact_lock(hashtextextended(v_business::text || '|tire|' || v_key, 0));
      IF v_sku IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_business::text || '|sku|' || lower(v_sku), 0));
        SELECT product_id, identity_key INTO v_sku_product, v_sku_key
        FROM public.import_tire_identity
        WHERE business_id = v_business
          AND lower(btrim(sku)) = lower(v_sku);
        IF v_sku_product IS NOT NULL AND v_sku_key IS DISTINCT FROM v_key THEN
          RAISE EXCEPTION 'Supplier SKU belongs to a different tire';
        END IF;
      ELSE
        v_sku_product := NULL;
      END IF;

      SELECT product_id INTO v_key_product
      FROM public.import_tire_identity
      WHERE business_id = v_business
        AND identity_key = v_key;
      IF v_sku_product IS NOT NULL AND v_key_product IS NOT NULL AND v_sku_product <> v_key_product THEN
        RAISE EXCEPTION 'Ambiguous tire identity';
      END IF;
      v_product := COALESCE(v_sku_product, v_key_product);
      v_legacy_count := 0;

      -- Legacy catalog products have no tire columns. The product name is not identity.
      -- A purchase-order line counts only when brand, model, size, load, and speed
      -- are all stored and equal. A missing speed or load is not a match.
      IF v_product IS NULL AND v_speed IS NOT NULL THEN
        SELECT count(*)::integer, (array_agg(hits.product_id))[1]
          INTO v_legacy_count, v_product
        FROM (
          SELECT DISTINCT pol.product_id
          FROM public.purchase_order_lines pol
          JOIN public.purchase_orders po ON po.id = pol.purchase_order_id
          JOIN public.products p ON p.id = pol.product_id AND p.business_id = v_business
          WHERE po.business_id = v_business
            AND pol.product_id IS NOT NULL
            AND regexp_replace(lower(btrim(COALESCE(pol.brand, ''))), '\s+', ' ', 'g')
                = regexp_replace(lower(v_brand), '\s+', ' ', 'g')
            AND regexp_replace(lower(btrim(COALESCE(pol.model, ''))), '\s+', ' ', 'g')
                = regexp_replace(lower(v_model), '\s+', ' ', 'g')
            AND CASE
              WHEN pol.load_index ~ '^[1-9][0-9]{0,2}$'
              THEN pol.load_index::integer = v_load AND pol.load_index::integer BETWEEN 1 AND 279
              ELSE false
            END
            AND upper(btrim(COALESCE(pol.speed_rating, ''))) = v_speed
            AND upper(btrim(COALESCE(pol.speed_rating, ''))) ~ '^[A-Z]{1,2}$'
            AND CASE
              WHEN regexp_replace(upper(btrim(COALESCE(pol.size_label, ''))), '\s+', '', 'g') ~ '^[0-9]+/[0-9]+R[0-9]+(\.[0-9])?$'
              THEN split_part(regexp_replace(upper(btrim(pol.size_label)), '\s+', '', 'g'), '/', 1)::integer = v_width
                AND split_part(split_part(regexp_replace(upper(btrim(pol.size_label)), '\s+', '', 'g'), '/', 2), 'R', 1)::integer = v_aspect
                AND round(split_part(regexp_replace(upper(btrim(pol.size_label)), '\s+', '', 'g'), 'R', 2)::numeric, 1) = v_rim
              ELSE false
            END
        ) hits;
        IF v_legacy_count > 1 THEN
          RAISE EXCEPTION 'Ambiguous tire identity';
        END IF;
        IF v_legacy_count = 1 AND EXISTS (
          SELECT 1 FROM public.import_tire_identity
          WHERE product_id = v_product
            AND identity_key IS DISTINCT FROM v_key
        ) THEN
          RAISE EXCEPTION 'Ambiguous tire identity';
        END IF;
      END IF;

      IF v_product IS NULL THEN
        INSERT INTO public.products (business_id, name, quantity, created_by, price, cost, barcode)
        VALUES (v_business, v_description, 0, auth.uid(), NULL, NULL, NULL)
        RETURNING id INTO v_product;
        v_legacy_count := 1;
      END IF;
      IF v_legacy_count = 1 THEN
        INSERT INTO public.import_tire_identity (
          product_id, business_id, brand_name, model_name, width_mm, aspect_ratio, rim_inch,
          load_index, speed_rating, sku, identity_key
        ) VALUES (
          v_product, v_business, v_brand, v_model, v_width, v_aspect, v_rim,
          v_load, v_speed, v_sku, v_key
        );
      END IF;
      -- An existing product is referenced only. Quantity, price, cost, and its name are not updated.
    END IF;

    INSERT INTO public.import_order_items (
      import_order_id, business_id, product_id, manufacturer_name, model_name, size_label,
      supplier_sku, product_description, ordered_quantity, supplier_unit_cost, currency_code,
      planned_sale_price_ils, load_index, speed_rating
    ) VALUES (
      v_order,
      v_business,
      v_product,
      NULLIF(btrim(COALESCE(v_line->>'brand', '')), ''),
      NULLIF(btrim(COALESCE(v_line->>'model', '')), ''),
      COALESCE(NULLIF(v_size, ''), NULLIF(btrim(COALESCE(v_line->>'size_label', '')), '')),
      NULLIF(btrim(COALESCE(v_line->>'sku', '')), ''),
      v_description,
      v_quantity,
      v_cost,
      p_payload->>'currency_code',
      v_sale,
      v_load,
      v_speed
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_order, 'replayed', v_replayed);
END;
$$;

REVOKE ALL ON FUNCTION public.import_wizard_commit(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_wizard_commit(jsonb) TO authenticated;

COMMENT ON FUNCTION public.import_wizard_commit(jsonb) IS
  'Creates one import order, its lines, and any new tire at quantity 0. Does not insert inventory_actions and does not update products.quantity.';

COMMIT;
