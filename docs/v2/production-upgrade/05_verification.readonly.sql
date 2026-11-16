-- READ ONLY. Run after 01, 02, and 03 have committed.
-- Compare products and inventory_actions with the preflight result.
-- Stop if any row has result = 'fail'. Do not turn feature flags on while a row fails.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT ord, check_name, result, detail
FROM (
  SELECT 10 AS ord, 'database' AS check_name, current_database() AS result, current_user AS detail
  UNION ALL
  SELECT 20, 'employees_rls',
    CASE WHEN to_regclass('public.employees') IS NOT NULL AND EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'employees' AND c.relrowsecurity
    ) THEN 'pass' ELSE 'fail' END,
    'directory exists and RLS is on'
  UNION ALL
  SELECT 30, 'employee_policies',
    CASE WHEN (
      SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'employees'
        AND policyname IN ('employees_member_read', 'employees_owner_insert', 'employees_owner_update')
    ) = 3 THEN 'pass' ELSE 'fail' END,
    'read member, owner insert, owner update; no delete policy'
  UNION ALL
  SELECT 40, 'sale_rls',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'sale_transactions' AND c.relrowsecurity
    ) AND EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'sale_lines' AND c.relrowsecurity
    ) THEN 'pass' ELSE 'fail' END,
    'both sale tables have RLS'
  UNION ALL
  SELECT 50, 'sale_write_grants',
    CASE WHEN has_table_privilege('authenticated', 'public.sale_transactions', 'INSERT')
           OR has_table_privilege('authenticated', 'public.sale_lines', 'INSERT')
           OR has_table_privilege('anon', 'public.sale_transactions', 'SELECT')
           OR has_table_privilege('anon', 'public.sale_lines', 'SELECT')
      THEN 'fail' ELSE 'pass' END,
    'authenticated reads through RLS; anon has no read; no direct insert'
  UNION ALL
  SELECT 60, 'sale_functions',
    CASE WHEN to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NOT NULL
          AND to_regprocedure('public.reverse_quick_sale(uuid,uuid)') IS NOT NULL
          AND to_regprocedure('public.guard_quick_sale_movement()') IS NOT NULL
      THEN 'pass' ELSE 'fail' END,
    'new functions only'
  UNION ALL
  SELECT 70, 'legacy_reverse_unchanged',
    CASE WHEN to_regprocedure('public.reverse_inventory_action(uuid)') IS NULL THEN 'fail' ELSE 'pass' END,
    md5(coalesce((
      SELECT p.prosrc FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'reverse_inventory_action'
    ), ''))
  UNION ALL
  SELECT 80, 'movement_guard',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_guard_quick_sale_movement' AND NOT tgisinternal
        AND tgrelid = 'public.inventory_actions'::regclass
    ) THEN 'pass' ELSE 'fail' END,
    'before update on inventory_actions'
  UNION ALL
  SELECT 90, 'no_superseded_column',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.inventory_actions'::regclass
        AND attname = 'salesperson_employee_id' AND NOT attisdropped
    ) THEN 'fail' ELSE 'pass' END,
    'salesperson stays on sale_transactions'
  UNION ALL
  SELECT 100, 'employees_not_seeded',
    CASE WHEN (SELECT count(*) FROM public.employees) = 0 THEN 'pass' ELSE 'review' END,
    (SELECT count(*)::text || ' rows' FROM public.employees)
  UNION ALL
  SELECT 110, 'no_sales_written',
    CASE WHEN (SELECT count(*) FROM public.sale_transactions) = 0
          AND (SELECT count(*) FROM public.sale_lines) = 0
      THEN 'pass' ELSE 'review' END,
    'a prepared upgrade has no sale rows yet'
  UNION ALL
  SELECT 120, 'no_quick_sale_movements',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.inventory_actions WHERE reference_type = 'sale_transaction'
    ) THEN 'review' ELSE 'pass' END,
    'migration must not insert movements'
  UNION ALL
  SELECT 130, 'products_after',
    (SELECT count(*)::text FROM public.products),
    (SELECT COALESCE(sum(quantity), 0)::text || ' units' FROM public.products)
  UNION ALL
  SELECT 140, 'actions_after',
    (SELECT count(*)::text FROM public.inventory_actions),
    (SELECT count(*) FILTER (WHERE sale_total_ils IS NOT NULL)::text || ' legacy sales with an amount'
     FROM public.inventory_actions)
) checks
ORDER BY ord;

COMMIT;
