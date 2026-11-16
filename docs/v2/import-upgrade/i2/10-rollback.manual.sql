-- MANUAL ROLLBACK for an empty schema only.
-- This file is not production recovery.
--
-- Three situations:
-- 1. Empty schema-only deployment. New I2 tables contain zero rows.
--    SET i2.recovery = 'empty-schema' in this session, then run this file.
--    It removes I2 objects and the added columns.
-- 2. Schema containing business records. If any new I2 table has a row,
--    this file stops and drops nothing. Keep the rows. Repair forward
--    or restore a backup.
-- 3. Production recovery. Take a backup and get explicit approval.
--    Restoring production is a backup restore, not this script.
--
-- Running the file without the session setting stops before any drop.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $guard$
DECLARE
  v_name text;
  v_count bigint;
BEGIN
  IF current_setting('i2.recovery', true) IS DISTINCT FROM 'empty-schema' THEN
    RAISE EXCEPTION 'I2 recovery refused. Empty-schema removal requires SET i2.recovery = ''empty-schema'' in this session. Schemas with business records are not dropped. Production recovery requires a backup and explicit approval.';
  END IF;
  FOREACH v_name IN ARRAY ARRAY[
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
    IF to_regclass('public.' || v_name) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', v_name) INTO v_count;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'I2 recovery refused: public.% contains % business records. Production recovery requires a backup and explicit approval.', v_name, v_count;
      END IF;
    END IF;
  END LOOP;
END;
$guard$;

DROP TABLE IF EXISTS public.goods_receipt_events;
DROP TABLE IF EXISTS public.goods_receipt_lines;
DROP TABLE IF EXISTS public.goods_receipts;
DROP FUNCTION IF EXISTS public.save_goods_receipt_draft(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.post_goods_receipt(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.i2_goods_receipt_block_posting();
DROP FUNCTION IF EXISTS public.i2_goods_receipt_line_guard();

DROP TABLE IF EXISTS public.import_landed_adjustments;
DROP TABLE IF EXISTS public.import_cost_allocation_lines;
DROP TABLE IF EXISTS public.import_cost_allocations;
DROP TABLE IF EXISTS public.import_shared_expenses;
DROP FUNCTION IF EXISTS public.preview_shared_expense_allocation(numeric, jsonb);
DROP FUNCTION IF EXISTS public.i2_allocation_enforce();
DROP FUNCTION IF EXISTS public.i2_shared_expense_scope_guard();
DROP FUNCTION IF EXISTS public.i2_shared_receiving_authoritative();
DROP FUNCTION IF EXISTS public.i2_posted_accepted_quantity(uuid, uuid, uuid, uuid);

DROP TRIGGER IF EXISTS i2_import_payments_document_guard ON public.import_payments;
ALTER TABLE public.import_payments DROP CONSTRAINT IF EXISTS i2_import_payments_document_fkey;
ALTER TABLE public.import_payments DROP COLUMN IF EXISTS import_document_id;
DROP FUNCTION IF EXISTS public.import_supplier_balance(uuid);
DROP FUNCTION IF EXISTS public.i2_payment_document_guard();

DROP TABLE IF EXISTS public.import_shipment_events;
DROP TABLE IF EXISTS public.import_shipment_lines;
DROP TABLE IF EXISTS public.import_container_orders;
DROP TABLE IF EXISTS public.import_shipment_orders;
DROP TABLE IF EXISTS public.import_containers;
DROP TABLE IF EXISTS public.import_shipments;
DROP FUNCTION IF EXISTS public.record_import_shipment_event(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.i2_container_order_guard();
DROP FUNCTION IF EXISTS public.i2_shipment_line_guard();

DROP TABLE IF EXISTS public.import_commercial_events;
DROP TABLE IF EXISTS public.import_order_term_snapshots;
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS i2_import_orders_commercial_status_check;
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS i2_import_orders_version_check;
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS i2_import_orders_payment_state_check;
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS i2_import_orders_shipment_state_check;
ALTER TABLE public.import_orders DROP CONSTRAINT IF EXISTS i2_import_orders_receiving_state_check;
ALTER TABLE public.import_orders
  DROP COLUMN IF EXISTS commercial_status,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS confirmed_by,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS actual_arrival_on,
  DROP COLUMN IF EXISTS payment_state,
  DROP COLUMN IF EXISTS shipment_state,
  DROP COLUMN IF EXISTS receiving_state;
DROP FUNCTION IF EXISTS public.save_import_commercial_terms(uuid, uuid, integer, boolean);
DROP FUNCTION IF EXISTS public.i2_reject_append_only();

DROP TABLE IF EXISTS public.product_media_references;
DROP TABLE IF EXISTS public.product_supplier_skus;
DROP TABLE IF EXISTS public.product_price_lists;
DROP TABLE IF EXISTS public.product_tire_specs;

DROP INDEX IF EXISTS public.i2_purchase_order_lines_business_id_id_key;
DROP INDEX IF EXISTS public.i2_purchase_orders_business_id_id_key;
DROP INDEX IF EXISTS public.i2_import_documents_business_id_id_key;
DROP INDEX IF EXISTS public.i2_import_costs_business_id_id_key;
DROP INDEX IF EXISTS public.i2_import_order_items_business_id_id_key;
DROP INDEX IF EXISTS public.i2_import_orders_business_id_id_key;
DROP INDEX IF EXISTS public.i2_suppliers_business_id_id_key;
DROP INDEX IF EXISTS public.i2_products_business_id_id_key;
DROP FUNCTION IF EXISTS public.import_upgrade_is_member(uuid);

COMMIT;
