-- READ ONLY. DO NOT APPLY A MIGRATION FROM THIS FILE.
-- Run in the SQL editor of the intended project and keep the result.
-- Stop if any row has result = 'block'.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT ord, check_name, result, detail
FROM (
  SELECT 10 AS ord, 'database' AS check_name, current_database() AS result, current_user AS detail
  UNION ALL
  SELECT 20, 'server_version', current_setting('server_version'), inet_server_addr()::text
  UNION ALL
  SELECT 30, 'employees',
    CASE WHEN to_regclass('public.employees') IS NULL THEN 'absent' ELSE 'present' END,
    'absent is expected before 01; present is accepted when the directory shape matches'
  UNION ALL
  SELECT 40, 'sale_transactions',
    CASE WHEN to_regclass('public.sale_transactions') IS NULL THEN 'ok' ELSE 'block' END,
    'must be absent'
  UNION ALL
  SELECT 50, 'sale_lines',
    CASE WHEN to_regclass('public.sale_lines') IS NULL THEN 'ok' ELSE 'block' END,
    'must be absent'
  UNION ALL
  SELECT 60, 'complete_quick_sale',
    CASE WHEN to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NULL THEN 'ok' ELSE 'block' END,
    'must be absent'
  UNION ALL
  SELECT 70, 'reverse_quick_sale',
    CASE WHEN to_regprocedure('public.reverse_quick_sale(uuid,uuid)') IS NULL THEN 'ok' ELSE 'block' END,
    'must be absent'
  UNION ALL
  SELECT 80, 'reverse_inventory_action',
    CASE WHEN to_regprocedure('public.reverse_inventory_action(uuid)') IS NULL THEN 'block' ELSE 'ok' END,
    md5(coalesce((
      SELECT p.prosrc FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'reverse_inventory_action'
    ), ''))
  UNION ALL
  SELECT 90, 'is_business_member',
    CASE WHEN to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL THEN 'block' ELSE 'ok' END,
    'required'
  UNION ALL
  SELECT 100, 'can_business_write',
    CASE WHEN to_regprocedure('public.can_business_write(uuid)') IS NULL THEN 'block' ELSE 'ok' END,
    'required'
  UNION ALL
  SELECT 110, 'superseded_salesperson_column',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.inventory_actions'::regclass
        AND attname = 'salesperson_employee_id' AND NOT attisdropped
    ) THEN 'block' ELSE 'ok' END,
    'docs/v2/employee-sales-attribution.UNAPPLIED.sql must not have been applied'
  UNION ALL
  SELECT 120, 'product_columns',
    CASE WHEN (
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products'
        AND column_name IN ('id', 'business_id', 'quantity', 'cost', 'price', 'updated_at')
    ) = 6 THEN 'ok' ELSE 'block' END,
    'id, business_id, quantity, cost, price, updated_at'
  UNION ALL
  SELECT 130, 'movement_columns',
    CASE WHEN (
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_actions'
        AND column_name IN (
          'id', 'business_id', 'product_id', 'user_id', 'action_type', 'quantity_changed',
          'sale_total_ils', 'cost_snapshot_ils', 'reference_type', 'reference_id', 'source',
          'is_reversal', 'reversed_at', 'reversed_by', 'reverses_action_id'
        )
    ) = 15 THEN 'ok' ELSE 'block' END,
    'legacy movement shape'
  UNION ALL
  SELECT 140, 'business_owner_column',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'owner_id'
    ) THEN 'ok' ELSE 'block' END,
    'owner management boundary'
  UNION ALL
  SELECT 150, 'products',
    (SELECT count(*)::text FROM public.products),
    (SELECT COALESCE(sum(quantity), 0)::text || ' units; ' || count(*) FILTER (WHERE quantity < 0)::text || ' negative; ' || count(*) FILTER (WHERE cost IS NULL)::text || ' unknown cost'
     FROM public.products)
  UNION ALL
  SELECT 160, 'inventory_actions',
    (SELECT count(*)::text FROM public.inventory_actions),
    (SELECT count(*) FILTER (WHERE sale_total_ils IS NOT NULL)::text || ' legacy sales with an amount'
     FROM public.inventory_actions)
  UNION ALL
  SELECT 170, 'employees_rows',
    CASE WHEN to_regclass('public.employees') IS NULL THEN 'absent' ELSE 'present' END,
    'row count is checked after 01; this script does not insert employees'
) checks
ORDER BY ord;

COMMIT;
