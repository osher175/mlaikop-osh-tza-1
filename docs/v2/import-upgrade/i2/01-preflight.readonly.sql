-- UNAPPLIED READ-ONLY PREFLIGHT. Do not execute against production without a
-- separate approval. This script only reads the system catalog. It does not
-- insert, update, delete, or alter objects. A failed check means: stop.
-- It does not require inventory_lots and it does not enable receipt posting.

DO $preflight$
DECLARE
  v_status_def text;
  v_required text;
  v_new_name text;
  v_rel text;
  v_col text;
  v_typ text;
  v_need_notnull boolean;
  v_spec text;
BEGIN
  FOREACH v_required IN ARRAY ARRAY[
    'public.businesses',
    'public.suppliers',
    'public.products',
    'public.import_orders',
    'public.import_order_items',
    'public.import_costs',
    'public.import_payments',
    'public.import_documents',
    'public.import_events',
    'public.import_receipts',
    'public.import_receipt_items',
    'public.import_receipt_corrections',
    'public.import_cost_adjustments',
    'public.purchase_orders',
    'public.purchase_order_lines'
  ]
  LOOP
    IF to_regclass(v_required) IS NULL THEN
      RAISE EXCEPTION 'I2 preflight: required relation % is missing', v_required;
    END IF;
  END LOOP;

  FOREACH v_required IN ARRAY ARRAY[
    'public.is_business_member(uuid,uuid)',
    'public.can_business_write(uuid)',
    'public.can_manage_business_imports(uuid,uuid)',
    'public.import_receipt_confirm(uuid)',
    'public.import_receipt_save_draft(uuid,jsonb)',
    'public.import_order_landed_cost(uuid)',
    'public.import_assign_number()',
    'public.execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)',
    'public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb,uuid,integer,date,text,text)',
    'public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)'
  ]
  LOOP
    IF to_regprocedure(v_required) IS NULL THEN
      RAISE EXCEPTION 'I2 preflight: required function % is missing', v_required;
    END IF;
  END LOOP;

  -- Column expectations are an array, not SELECT ... FROM (VALUES ...).
  -- PL/pgSQL rejects that FOR-query form and stops at FROM.
  FOREACH v_spec IN ARRAY ARRAY[
    'public.import_orders|id|uuid|1',
    'public.import_orders|business_id|uuid|1',
    'public.import_orders|import_number|text|1',
    'public.import_orders|status|text|1',
    'public.import_orders|currency_code|text|1',
    'public.import_orders|supplier_id|uuid|0',
    'public.import_orders|working_exchange_rate_to_ils|numeric%|0',
    'public.import_order_items|id|uuid|1',
    'public.import_order_items|business_id|uuid|1',
    'public.import_order_items|import_order_id|uuid|1',
    'public.import_order_items|ordered_quantity|integer|1',
    'public.import_order_items|not_arriving_quantity|integer|1',
    'public.import_order_items|supplier_unit_cost|numeric%|1',
    'public.import_order_items|currency_code|text|1',
    'public.import_costs|id|uuid|1',
    'public.import_costs|business_id|uuid|1',
    'public.import_costs|import_order_id|uuid|1',
    'public.import_costs|amount|numeric%|1',
    'public.import_costs|effective_amount_ils|numeric%|0',
    'public.import_payments|id|uuid|1',
    'public.import_payments|business_id|uuid|1',
    'public.import_payments|import_order_id|uuid|1',
    'public.import_payments|amount|numeric%|1',
    'public.import_payments|currency_code|text|1',
    'public.import_payments|exchange_rate_to_ils|numeric%|0',
    'public.import_payments|payment_status|text|1',
    'public.import_payments|payment_type|text|1',
    'public.import_payments|import_cost_id|uuid|0',
    'public.products|id|uuid|1',
    'public.products|business_id|uuid|1',
    'public.products|quantity|integer|1',
    'public.products|cost|numeric%|0',
    'public.products|price|numeric%|0',
    'public.products|image|text|0',
    'public.purchase_orders|id|uuid|1',
    'public.purchase_orders|business_id|uuid|1',
    'public.purchase_orders|status|text|1',
    'public.purchase_orders|version|integer|1',
    'public.purchase_orders|idempotency_key|uuid|1',
    'public.purchase_order_lines|id|uuid|1',
    'public.purchase_order_lines|business_id|uuid|1',
    'public.purchase_order_lines|purchase_order_id|uuid|1',
    'public.purchase_order_lines|ordered_qty|integer|1',
    'public.purchase_order_lines|received_qty|integer|1'
  ]
  LOOP
    v_rel := split_part(v_spec, '|', 1);
    v_col := split_part(v_spec, '|', 2);
    v_typ := split_part(v_spec, '|', 3);
    v_need_notnull := split_part(v_spec, '|', 4) = '1';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = v_rel::regclass
        AND attname = v_col
        AND NOT attisdropped
        AND format_type(atttypid, atttypmod) LIKE v_typ
        AND (NOT v_need_notnull OR attnotnull)
    ) THEN
      RAISE EXCEPTION 'I2 preflight: %.% must match %', v_rel, v_col, v_typ;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.import_orders'::regclass AND contype = 'p'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.import_order_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.import_orders'::regclass
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.purchase_order_lines'::regclass
      AND contype = 'f'
      AND confrelid = 'public.purchase_orders'::regclass
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND contype = 'f'
      AND confrelid = 'public.businesses'::regclass
  ) THEN
    RAISE EXCEPTION 'I2 preflight: a required key or foreign key is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.import_orders'::regclass
      AND i.indisunique
      AND pg_get_indexdef(i.indexrelid) ILIKE '%import_number%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = 'public.purchase_orders'::regclass
      AND i.indisunique
      AND pg_get_indexdef(i.indexrelid) ILIKE '%idempotency_key%'
  ) THEN
    RAISE EXCEPTION 'I2 preflight: a required unique key is missing';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.import_receipt_confirm(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.save_purchase_order(uuid,uuid,boolean,uuid,uuid,date,jsonb,uuid,integer,date,text,text)', 'EXECUTE')
     OR NOT has_table_privilege('authenticated', 'public.import_orders', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.import_receipts', 'SELECT') THEN
    RAISE EXCEPTION 'I2 preflight: legacy import or domestic purchase permissions drifted';
  END IF;

  IF has_function_privilege('authenticated', 'public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I2 preflight: domestic receipt posting must stay revoked';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.import_orders'::regclass
      AND attname = 'import_number'
      AND attnotnull
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'I2 preflight: import_orders.import_number must stay NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.products'::regclass
      AND attname = 'image'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'I2 preflight: products.image is missing';
  END IF;

  SELECT string_agg(pg_get_constraintdef(oid), ' ')
    INTO v_status_def
  FROM pg_constraint
  WHERE conrelid = 'public.import_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%ordered%'
    AND pg_get_constraintdef(oid) LIKE '%completed%'
    AND pg_get_constraintdef(oid) LIKE '%cancelled%';

  IF v_status_def IS NULL THEN
    RAISE EXCEPTION 'I2 preflight: import order logistics status list drifted';
  END IF;

  FOREACH v_new_name IN ARRAY ARRAY[
    'commercial_status',
    'confirmed_at',
    'confirmed_by',
    'version',
    'actual_arrival_on',
    'payment_state',
    'shipment_state',
    'receiving_state'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.import_orders'::regclass
        AND attname = v_new_name
        AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'I2 preflight: import_orders.% already exists', v_new_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.import_payments'::regclass
      AND attname = 'import_document_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'I2 preflight: import_payments.import_document_id already exists';
  END IF;

  FOREACH v_new_name IN ARRAY ARRAY[
    'product_tire_specs',
    'product_price_lists',
    'product_supplier_skus',
    'product_media_references',
    'import_order_term_snapshots',
    'import_commercial_events',
    'import_shipments',
    'import_containers',
    'import_shipment_orders',
    'import_container_orders',
    'import_shipment_lines',
    'import_shipment_events',
    'import_shared_expenses',
    'import_cost_allocations',
    'import_cost_allocation_lines',
    'import_landed_adjustments',
    'goods_receipts',
    'goods_receipt_lines',
    'goods_receipt_events'
  ]
  LOOP
    IF to_regclass('public.' || v_new_name) IS NOT NULL THEN
      RAISE EXCEPTION 'I2 preflight: % already exists', v_new_name;
    END IF;
  END LOOP;

  IF to_regclass('public.inventory_lots') IS NULL THEN
    RAISE NOTICE 'I2 preflight: inventory_lots is absent. FIFO is not required.';
  ELSE
    RAISE NOTICE 'I2 preflight: inventory_lots is present and stays untouched.';
  END IF;
END;
$preflight$;
