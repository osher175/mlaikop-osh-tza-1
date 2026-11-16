-- UNAPPLIED READ-ONLY PREFLIGHT. Do not execute against production without a
-- separate approval. This script only reads the system catalog. It does not
-- insert, update, delete, or alter objects.

DO $preflight$
DECLARE
  v_name text;
  v_missing text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.businesses',
    'public.suppliers',
    'public.products',
    'public.inventory_actions',
    'public.supplier_quotes',
    'public.supplier_preferences',
    'public.procurement_requests',
    'public.import_orders',
    'public.import_order_items',
    'public.purchase_orders',
    'public.purchase_order_lines'
  ]
  LOOP
    IF to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION 'I3 preflight: required relation % is missing', v_name;
    END IF;
  END LOOP;

  FOREACH v_missing IN ARRAY ARRAY[
    'country',
    'serves_import',
    'serves_local'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = v_missing
    ) THEN
      RAISE EXCEPTION 'I3 preflight: suppliers.% already exists. Do not reapply the wizard migration blindly.', v_missing;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'import_orders' AND column_name = 'client_request_id'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'import_order_items' AND column_name = 'load_index'
  ) OR to_regclass('public.import_tire_identity') IS NOT NULL
     OR to_regproc('public.import_wizard_commit(jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'I3 preflight: wizard objects already exist. Stop and review the partial apply.';
  END IF;

  FOREACH v_name IN ARRAY ARRAY['model_name', 'size_label', 'not_arriving_quantity', 'ordered_quantity', 'received_quantity']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'import_order_items' AND column_name = v_name
    ) THEN
      RAISE EXCEPTION 'I3 preflight: import_order_items.% is missing', v_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'quantity' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'I3 preflight: products.quantity is missing or nullable';
  END IF;

  FOREACH v_name IN ARRAY ARRAY[
    'product_id', 'purchase_order_id', 'brand', 'model', 'size_label', 'load_index', 'speed_rating'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = v_name
    ) THEN
      RAISE EXCEPTION 'I3 preflight: purchase_order_lines.% is missing', v_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'business_id'
  ) THEN
    RAISE EXCEPTION 'I3 preflight: purchase_orders.business_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'can_manage_business_imports'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_business_member'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'import_quantity_in_transit'
  ) THEN
    RAISE EXCEPTION 'I3 preflight: import authorization or in-transit function is missing';
  END IF;

  -- I2 is not required. These names are reported by raising only when this
  -- script is pointed at a database that already mixed a partial I3 apply.
  -- Their presence is allowed and does not block I3.
  PERFORM to_regclass('public.product_tire_specs');
  PERFORM to_regclass('public.import_shipments');
  PERFORM to_regclass('public.purchase_orders');

  RAISE NOTICE 'I3 preflight passed. suppliers has no import classification yet. I2 tables are not required.';
END;
$preflight$;
