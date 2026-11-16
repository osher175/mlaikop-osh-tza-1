-- DISPOSABLE DATABASE ONLY.
-- Refuses unless this session has:
--   SET i2.disposable_database = 'authorized';
-- Never point this file at production. The runner also rejects the production
-- project ref before it can open a connection. Every case rolls back.

DO $refuse$
BEGIN
  IF current_setting('i2.disposable_database', true) IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'I2 disposable tests refused. Set i2.disposable_database = ''authorized'' on a disposable database. Do not run this against production.';
  END IF;
END;
$refuse$;

BEGIN;

DO $cases$
DECLARE
  v_business_a uuid;
  v_business_b uuid;
  v_owner uuid;
  v_supplier uuid;
  v_order_a uuid;
  v_order_b uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_shipment uuid;
  v_container uuid;
  v_expense uuid;
  v_allocation uuid;
  v_cost uuid;
  v_other uuid;
  v_receipt uuid;
BEGIN
  IF to_regclass('public.import_shipment_lines') IS NULL
     OR to_regclass('public.import_cost_allocations') IS NULL
     OR to_regclass('public.goods_receipts') IS NULL THEN
    RAISE EXCEPTION 'I2 schema is not loaded on this disposable database';
  END IF;

  SELECT id INTO v_owner FROM auth.users LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'disposable database has no auth user for the fixture';
  END IF;

  INSERT INTO public.businesses (name, owner_id)
  VALUES ('i2 disposable a', v_owner)
  RETURNING id INTO v_business_a;
  INSERT INTO public.businesses (name, owner_id)
  VALUES ('i2 disposable b', v_owner)
  RETURNING id INTO v_business_b;

  INSERT INTO public.suppliers (business_id, name)
  VALUES (v_business_a, 'i2 supplier')
  RETURNING id INTO v_supplier;

  INSERT INTO public.import_orders (business_id, import_number, supplier_id, currency_code, created_by)
  VALUES (v_business_a, 'I2-TEST-A', v_supplier, 'USD', v_owner)
  RETURNING id INTO v_order_a;
  INSERT INTO public.import_order_items (
    import_order_id, business_id, product_description, ordered_quantity, supplier_unit_cost, currency_code
  ) VALUES (v_order_a, v_business_a, 'tire a', 10, 1, 'USD')
  RETURNING id INTO v_item_a;
  INSERT INTO public.import_orders (business_id, import_number, currency_code, created_by)
  VALUES (v_business_b, 'I2-TEST-B', 'USD', v_owner)
  RETURNING id INTO v_order_b;
  INSERT INTO public.import_order_items (
    import_order_id, business_id, product_description, ordered_quantity, supplier_unit_cost, currency_code
  ) VALUES (v_order_b, v_business_b, 'tire other business', 10, 1, 'USD')
  RETURNING id INTO v_item_b;

  INSERT INTO public.import_shipments (business_id, shipment_number)
  VALUES (v_business_a, 'I2-SHIP')
  RETURNING id INTO v_shipment;
  INSERT INTO public.import_shipment_orders (business_id, shipment_id, import_order_id)
  VALUES (v_business_a, v_shipment, v_order_a);

  BEGIN
    INSERT INTO public.import_shipment_lines (
      business_id, shipment_id, import_order_item_id, quantity
    ) VALUES (v_business_a, v_shipment, v_item_b, 1);
    RAISE EXCEPTION 'tenant isolation failed: cross-business shipment line was accepted';
  EXCEPTION
    WHEN foreign_key_violation OR check_violation THEN
      NULL;
  END;

  INSERT INTO public.import_orders (business_id, import_number, supplier_id, currency_code, created_by)
  VALUES (v_business_a, 'I2-TEST-A2', v_supplier, 'USD', v_owner)
  RETURNING id INTO v_order_b;
  INSERT INTO public.import_order_items (
    import_order_id, business_id, product_description, ordered_quantity, supplier_unit_cost, currency_code
  ) VALUES (v_order_b, v_business_a, 'tire outside container', 10, 1, 'USD')
  RETURNING id INTO v_item_b;
  INSERT INTO public.import_containers (business_id, shipment_id, container_number)
  VALUES (v_business_a, v_shipment, 'CONT-1')
  RETURNING id INTO v_container;
  INSERT INTO public.import_container_orders (business_id, container_id, import_order_id)
  VALUES (v_business_a, v_container, v_order_a);

  INSERT INTO public.import_costs (
    import_order_id, business_id, category, amount, currency_code, created_by
  ) VALUES (v_order_b, v_business_a, 'port', 10, 'ILS', v_owner)
  RETURNING id INTO v_cost;
  BEGIN
    INSERT INTO public.import_cost_allocations (
      business_id, import_cost_id, import_order_id, import_order_item_id,
      basis, amount_to_allocate_ils
    ) VALUES (
      v_business_a, v_cost, v_order_a, v_item_a, 'direct_line', 1
    );
    RAISE EXCEPTION 'direct allocation accepted a cost from another order';
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      NULL;
  END;

  INSERT INTO public.import_shipment_lines (
    business_id, shipment_id, container_id, import_order_item_id, quantity
  ) VALUES (v_business_a, v_shipment, v_container, v_item_a, 6);

  BEGIN
    INSERT INTO public.import_shipment_lines (
      business_id, shipment_id, container_id, import_order_item_id, quantity
    ) VALUES (v_business_a, v_shipment, v_container, v_item_a, 5);
    RAISE EXCEPTION 'concurrent quantity guard failed: 11 were accepted for 10 ordered';
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      NULL;
  END;

  INSERT INTO public.import_shared_expenses (
    business_id, shipment_id, container_id, category, amount, currency_code,
    exchange_rate_to_ils, amount_ils, capitalize
  ) VALUES (
    v_business_a, v_shipment, v_container, 'port', 100, 'ILS', 1, 100, true
  ) RETURNING id INTO v_expense;

  INSERT INTO public.import_cost_allocations (
    business_id, shared_expense_id, shipment_id, container_id,
    basis, amount_to_allocate_ils
  ) VALUES (
    v_business_a, v_expense, v_shipment, v_container, 'per_accepted_tire', 100
  ) RETURNING id INTO v_allocation;

  BEGIN
    INSERT INTO public.import_cost_allocations (
      business_id, shared_expense_id, shipment_id, container_id,
      basis, amount_to_allocate_ils
    ) VALUES (
      v_business_a, v_expense, v_shipment, v_container, 'per_accepted_tire', 1
    );
    RAISE EXCEPTION 'duplicate allocation was accepted';
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.import_cost_allocation_lines (
      business_id, allocation_id, import_order_item_id, accepted_quantity,
      exact_share_ils, rounded_share_ils
    ) VALUES (v_business_a, v_allocation, v_item_b, 1, 1, 1);
    RAISE EXCEPTION 'allocation line outside the parent container was accepted';
  EXCEPTION
    WHEN foreign_key_violation OR check_violation THEN
      NULL;
  END;

  BEGIN
    UPDATE public.import_cost_allocations
    SET sealed = true
    WHERE id = v_allocation;
    RAISE EXCEPTION 'worksheet allocation was sealed';
  EXCEPTION
    WHEN SQLSTATE '0A000' THEN
      NULL;
  END;

  INSERT INTO public.goods_receipts (business_id, import_order_id, idempotency_key)
  VALUES (v_business_a, v_order_a, gen_random_uuid())
  RETURNING id INTO v_receipt;

  BEGIN
    UPDATE public.goods_receipts SET status = 'posted' WHERE id = v_receipt;
    RAISE EXCEPTION 'receipt posting was accepted';
  EXCEPTION
    WHEN SQLSTATE '0A000' THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.goods_receipt_lines (
      business_id, goods_receipt_id, source_type, import_order_item_id,
      ordered_quantity, previously_accepted, accepted_quantity
    ) VALUES (
      v_business_a, v_receipt, 'import_order_item', v_item_a, 10, 4, 1
    );
    RAISE EXCEPTION 'unreconciled previously_accepted was accepted';
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      NULL;
  END;

  INSERT INTO public.goods_receipt_lines (
    business_id, goods_receipt_id, source_type, import_order_item_id, ordered_quantity
  ) VALUES (
    v_business_a, v_receipt, 'import_order_item', v_item_a, 10
  ) RETURNING id INTO v_other;

  IF v_other IS NULL THEN
    RAISE EXCEPTION 'draft receipt line with zero previous quantities was rejected';
  END IF;
END;
$cases$;

ROLLBACK;
