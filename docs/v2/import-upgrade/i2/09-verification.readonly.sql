-- UNAPPLIED READ-ONLY VERIFICATION. Run only after the I2 files, and only with approval.
-- Catalog and privilege checks. It does not update rows and it does not read
-- product quantities, payment amounts, or customer documents.

DO $verify$
DECLARE
  v_name text;
  v_expr text;
  v_def text;
  v_tables text[] := ARRAY[
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
  ];
  v_revoked text[] := ARRAY[
    'public.post_goods_receipt(uuid,uuid,uuid)',
    'public.save_goods_receipt_draft(uuid,uuid,jsonb)',
    'public.save_import_commercial_terms(uuid,uuid,integer,boolean)',
    'public.record_import_shipment_event(uuid,uuid,text,text)',
    'public.import_supplier_balance(uuid)',
    'public.preview_shared_expense_allocation(numeric,jsonb)'
  ];
BEGIN
  FOREACH v_name IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      RAISE EXCEPTION 'I2 verification: table % is missing', v_name;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || v_name, 'SELECT') THEN
      RAISE EXCEPTION 'I2 verification: % is not readable by a member session', v_name;
    END IF;
    IF has_table_privilege('authenticated', 'public.' || v_name, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || v_name, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || v_name, 'DELETE')
       OR has_table_privilege('anon', 'public.' || v_name, 'SELECT') THEN
      RAISE EXCEPTION 'I2 verification: % has an unintended privilege', v_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (v_tables)
      AND (c.relrowsecurity IS NOT TRUE OR c.relforcerowsecurity IS NOT TRUE)
  ) THEN
    RAISE EXCEPTION 'I2 verification: a new table is missing forced row security';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (v_tables)
      AND p.polcmd <> 'r'
  ) THEN
    RAISE EXCEPTION 'I2 verification: a new table has a write policy';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.goods_receipt_lines'::regclass
      AND c.contype = 'f'
      AND a.attname IN ('cost_layer_id', 'inventory_action_id')
  ) THEN
    RAISE EXCEPTION 'I2 verification: goods receipt lines must not reference inventory or cost layers yet';
  END IF;

  FOREACH v_name IN ARRAY v_revoked LOOP
    IF to_regprocedure(v_name) IS NULL THEN
      RAISE EXCEPTION 'I2 verification: function % is missing', v_name;
    END IF;
    IF has_function_privilege('authenticated', v_name, 'EXECUTE')
       OR has_function_privilege('anon', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'I2 verification: % must stay revoked', v_name;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('authenticated', 'public.import_upgrade_is_member(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'I2 verification: membership predicate is not executable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.i2_payment_document_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'I2 verification: payment document guard must remain executable so legacy payment updates do not fail';
  END IF;

  v_def := pg_get_functiondef('public.post_goods_receipt(uuid,uuid,uuid)'::regprocedure);
  IF v_def NOT LIKE '%goods receipt posting is not activated%'
     OR v_def LIKE '%execute_inventory_transaction%' THEN
    RAISE EXCEPTION 'I2 verification: posting stub drifted';
  END IF;

  v_def := pg_get_functiondef('public.preview_shared_expense_allocation(numeric,jsonb)'::regprocedure);
  IF v_def NOT LIKE '%ORDER BY b.remainder_num DESC, b.line_id ASC%'
     OR v_def LIKE '%execute_inventory_transaction%' THEN
    RAISE EXCEPTION 'I2 verification: allocation function drifted';
  END IF;

  v_def := pg_get_functiondef('public.import_supplier_balance(uuid)'::regprocedure);
  IF v_def NOT LIKE '%SUM(p.amount)%' OR v_def LIKE '%SUM(p.amount_ils)%' THEN
    RAISE EXCEPTION 'I2 verification: supplier balance must use the original currency amount';
  END IF;

  IF to_regprocedure('public.import_receipt_confirm(uuid)') IS NULL
     OR to_regprocedure('public.post_purchase_receipt(uuid,uuid,uuid,uuid,jsonb,boolean)') IS NULL
     OR to_regprocedure('public.import_order_landed_cost(uuid)') IS NULL
     OR to_regprocedure('public.import_assign_number()') IS NULL THEN
    RAISE EXCEPTION 'I2 verification: an existing import or receipt function disappeared';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'i2_goods_receipts_block_posting'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'I2 verification: posting block trigger is missing';
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid) INTO v_expr
  FROM pg_attrdef d
  JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE a.attrelid = 'public.import_orders'::regclass
    AND a.attname = 'commercial_status';
  IF v_expr IS NULL OR v_expr NOT LIKE '%confirmed%' THEN
    RAISE EXCEPTION 'I2 verification: commercial_status default must be confirmed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE a.attrelid = 'public.import_orders'::regclass
      AND a.attname IN (
        'confirmed_at', 'confirmed_by', 'actual_arrival_on',
        'payment_state', 'shipment_state', 'receiving_state'
      )
  ) THEN
    RAISE EXCEPTION 'I2 verification: a historical column has a default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.import_orders'::regclass
      AND attname = 'import_number'
      AND attnotnull
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'I2 verification: import_number nullability changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.import_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%ordered%'
      AND pg_get_constraintdef(oid) LIKE '%completed%'
      AND pg_get_constraintdef(oid) LIKE '%cancelled%'
  ) THEN
    RAISE EXCEPTION 'I2 verification: logistics status list changed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.products'::regclass
      AND attname IN ('id', 'quantity', 'cost', 'price', 'image')
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING COUNT(*) = 5
  ) THEN
    RAISE EXCEPTION 'I2 verification: a core product column is missing';
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid) INTO v_expr
  FROM pg_attrdef d
  JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE a.attrelid = 'public.import_cost_allocations'::regclass
    AND a.attname = 'cost_authority';
  IF v_expr IS NULL OR v_expr NOT LIKE '%worksheet%' THEN
    RAISE EXCEPTION 'I2 verification: allocation authority must default to worksheet';
  END IF;

  v_def := pg_get_functiondef('public.i2_shipment_line_guard()'::regprocedure);
  IF v_def NOT LIKE '%FOR UPDATE%' OR v_def NOT LIKE '%shipment quantity exceeds remaining ordered quantity%' THEN
    RAISE EXCEPTION 'I2 verification: shipment quantity lock drifted';
  END IF;

  v_def := pg_get_functiondef('public.i2_allocation_enforce()'::regprocedure);
  IF v_def NOT LIKE '%allocations capitalize the shared expense more than once%'
     OR v_def NOT LIKE '%allocation line is outside the parent%'
     OR v_def NOT LIKE '%direct allocation cost belongs to a different order%'
     OR v_def NOT LIKE '%landed-cost allocation is not a production-authoritative cost%'
     OR v_def NOT LIKE '%accepted quantity must come from posted receipts%' THEN
    RAISE EXCEPTION 'I2 verification: allocation guards drifted';
  END IF;

  v_def := pg_get_functiondef('public.i2_goods_receipt_line_guard()'::regprocedure);
  IF v_def NOT LIKE '%previously quantities must match posted receipt records%' THEN
    RAISE EXCEPTION 'I2 verification: previous-quantity reconciliation drifted';
  END IF;

  -- Nested on purpose. AND does not skip the regclass cast when the table is absent.
  IF to_regclass('public.inventory_lots') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid IN (
        'public.goods_receipts'::regclass,
        'public.goods_receipt_lines'::regclass,
        'public.import_shared_expenses'::regclass
      )
        AND contype = 'f'
        AND confrelid = to_regclass('public.inventory_lots')
    ) THEN
      RAISE EXCEPTION 'I2 verification: I2 must not attach to inventory_lots';
    END IF;
  END IF;
END;
$verify$;
