-- UNAPPLIED production transcription. Do not copy into supabase/migrations.
-- Do not execute this file in this task. It is not approval to run it.
-- The isolated file products-quantity-update-lock.UNAPPLIED.sql refuses
-- gtakgctmtayalcbpnryg. This file is the opposite gate and refuses the
-- isolated project. It runs only when the same transaction sets
-- mlaiko.apply_quantity_lock to gtakgctmtayalcbpnryg.
-- Do not set that value until https://www.mlaiko.com serves a bundle that
-- no longer patches products.quantity. An old open tab still can, until it
-- reloads, and this lock makes that save fail.
--
-- Closes direct authenticated writes of products.quantity.
-- Metadata columns, including cost and image, stay updatable.
-- Table-level UPDATE overrides a column REVOKE, so authenticated loses table
-- UPDATE and receives UPDATE only on the columns it can already edit except
-- quantity. INSERT stays table-level: live clients insert quantity 0.
-- A BEFORE INSERT trigger rejects every other quantity. It does not read the
-- session role. Authorized stock changes are UPDATEs inside the existing
-- SECURITY DEFINER functions, and those UPDATEs do not fire this trigger.
--
-- Inspected writers, from the function bodies this preflight reads again:
--   create_product_with_opening_stock inserts literal quantity 0, then calls
--   execute_inventory_transaction, which UPDATEs quantity.
--   reverse_inventory_action, import_receipt_confirm, and
--   import_receipt_correct change quantity only through an UPDATE or through
--   execute_inventory_transaction. None of them insert a nonzero quantity.
-- service_role grants are not modified. compress-storage-images updates image
-- with the service role and does not write quantity.
-- anon may hold its own table UPDATE. authenticated is not a member of anon.
-- The table grant is still revoked from anon, because a table grant overrides
-- a column revoke. quantity_reserved is excluded when that column exists.
-- A column added after this lock inherits no authenticated UPDATE, because
-- table UPDATE has already been revoked.
--
-- Deployment order. There is no app-shell service worker, so an open browser
-- tab keeps its current JavaScript until that tab reloads.
--   1. Confirm a backup. Production point-in-time recovery is UNVERIFIED.
--   2. Inventory reversal is already applied on production. Do not re-apply it.
--   3. Publish the client that sends quantity only through those functions.
--      Feature flags stay off. An old tab can still patch quantity until step 4.
--   4. Apply this file only after that published client is what users load.
--      A tab still running the old editor sends quantity in the product
--      update, and that whole save then fails.
--   5. Supplier-return reservation, if used, is applied after this file so
--      quantity_reserved is not included in the authenticated column grant.
--
-- Rollback, only if this file was applied and direct quantity edits must return:
--   DROP TRIGGER IF EXISTS trg_products_reject_nonzero_quantity_insert ON public.products;
--   DROP FUNCTION IF EXISTS public.products_reject_nonzero_quantity_insert();
--   GRANT UPDATE ON TABLE public.products TO authenticated;
--   GRANT UPDATE ON TABLE public.products TO anon;

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $quantity_lock$
DECLARE
  v_names text[] := ARRAY[
    'create_product_with_opening_stock',
    'execute_inventory_transaction',
    'reverse_inventory_action',
    'import_receipt_confirm',
    'import_receipt_correct'
  ];
  v_name text;
  v_count integer;
  v_def text;
  v_insert text;
  v_start integer;
  v_end integer;
  v_owner text;
  v_super boolean;
  v_definer boolean;
  v_owner_can_update boolean;
  v_keep text[];
  v_grant text;
  v_default text;
  v_service_image boolean;
  v_authenticated oid := (SELECT oid FROM pg_roles WHERE rolname = 'authenticated');
  v_anon oid := (SELECT oid FROM pg_roles WHERE rolname = 'anon');
BEGIN
  IF coalesce(current_setting('mlaiko.apply_quantity_lock', true), '') IS DISTINCT FROM 'gtakgctmtayalcbpnryg' THEN
    RAISE EXCEPTION 'refused: set mlaiko.apply_quantity_lock to gtakgctmtayalcbpnryg in this transaction';
  END IF;
  IF coalesce(current_setting('isolated.project_ref', true), '') <> '' THEN
    RAISE EXCEPTION 'isolated project refused; use products-quantity-update-lock.UNAPPLIED.sql';
  END IF;

  IF to_regclass('public.products') IS NULL OR v_authenticated IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'products, authenticated, or anon is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role is missing';
  END IF;

  SELECT c.column_default INTO v_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'products' AND c.column_name = 'quantity';
  IF v_default IS NULL OR btrim(v_default) NOT IN ('0', '(0)') THEN
    RAISE EXCEPTION 'products.quantity default is %, not 0', coalesce(v_default, 'NULL');
  END IF;

  -- anon can hold its own table UPDATE without authenticated inheriting it.
  -- That grant still overrides a later column revoke, so it is removed below.
  -- PUBLIC, or any role authenticated belongs to, is left untouched and blocks.
  IF EXISTS (
    SELECT 1
    FROM pg_class rel
    CROSS JOIN LATERAL aclexplode(rel.relacl) AS acl
    WHERE rel.oid = 'public.products'::regclass
      AND acl.privilege_type = 'UPDATE'
      AND (
        acl.grantee = 0
        OR (
          acl.grantee <> v_authenticated
          AND acl.grantee <> v_anon
          AND acl.grantee <> 0
          AND pg_has_role('authenticated', acl.grantee, 'member')
        )
      )
  ) THEN
    RAISE EXCEPTION 'PUBLIC or a role granted to authenticated has table-level UPDATE on products. Shared grants were not changed';
  END IF;

  FOREACH v_name IN ARRAY v_names LOOP
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name;
    IF v_count <> 1 THEN
      RAISE EXCEPTION '% overload count is %', v_name, v_count;
    END IF;

    SELECT p.prosecdef, r.rolname, r.rolsuper,
           has_column_privilege(r.oid, 'public.products'::regclass, 'quantity'::name, 'UPDATE'),
           pg_get_functiondef(p.oid)
    INTO v_definer, v_owner, v_super, v_owner_can_update, v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public' AND p.proname = v_name;

    IF NOT v_definer THEN
      RAISE EXCEPTION '% is not SECURITY DEFINER', v_name;
    END IF;
    IF NOT v_super AND NOT v_owner_can_update THEN
      RAISE EXCEPTION '% owner % cannot update products.quantity', v_name, v_owner;
    END IF;

    IF v_name = 'create_product_with_opening_stock' THEN
      v_start := position('INSERT INTO public.products' IN v_def);
      v_end := position('RETURNING id INTO v_product_id' IN v_def);
      IF v_start = 0 OR v_end <= v_start THEN
        RAISE EXCEPTION 'opening-stock insert was not found';
      END IF;
      v_insert := substring(v_def FROM v_start FOR (v_end - v_start));
      IF position(', 0, p_cost' IN v_insert) = 0 OR position('p_quantity' IN v_insert) > 0 THEN
        RAISE EXCEPTION 'opening-stock insert is not the literal quantity 0';
      END IF;
    ELSIF position('INSERT INTO public.products' IN v_def) > 0 THEN
      RAISE EXCEPTION '% inserts products; quantity insert guard refused', v_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname <> ALL (v_names)
      AND position('INSERT INTO public.products' IN pg_get_functiondef(p.oid)) > 0
  ) THEN
    RAISE EXCEPTION 'another SECURITY DEFINER function inserts products';
  END IF;

  SELECT coalesce(array_agg(a.attname ORDER BY a.attnum), ARRAY[]::text[])
  INTO v_keep
  FROM pg_attribute a
  WHERE a.attrelid = 'public.products'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attgenerated = ''
    AND a.attname <> 'quantity'
    AND a.attname <> 'quantity_reserved'
    AND has_column_privilege('authenticated', a.attrelid, a.attname, 'UPDATE');

  IF NOT ('cost' = ANY (v_keep) AND 'image' = ANY (v_keep) AND 'name' = ANY (v_keep)) THEN
    RAISE EXCEPTION 'cost, image, or name is not currently updatable by authenticated';
  END IF;

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinality)
  INTO v_grant
  FROM unnest(v_keep) WITH ORDINALITY AS kept(column_name, ordinality);
  IF v_grant IS NULL OR 'quantity' = ANY (v_keep) OR 'quantity_reserved' = ANY (v_keep) THEN
    RAISE EXCEPTION 'quantity column list is unsafe';
  END IF;

  v_service_image := has_column_privilege('service_role', 'public.products'::regclass, 'image'::name, 'UPDATE');

  REVOKE UPDATE ON TABLE public.products FROM anon, authenticated;
  REVOKE UPDATE (quantity) ON TABLE public.products FROM PUBLIC, anon, authenticated;
  EXECUTE format('GRANT UPDATE (%s) ON TABLE public.products TO authenticated', v_grant);

  IF has_column_privilege('authenticated', 'public.products'::regclass, 'quantity'::name, 'UPDATE')
     OR has_column_privilege('anon', 'public.products'::regclass, 'quantity'::name, 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated or anon can still UPDATE products.quantity through a direct, PUBLIC, or inherited grant';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.products'::regclass
      AND a.attname = 'quantity_reserved'
      AND NOT a.attisdropped
  ) AND (
    has_column_privilege('authenticated', 'public.products'::regclass, 'quantity_reserved'::name, 'UPDATE')
    OR has_column_privilege('anon', 'public.products'::regclass, 'quantity_reserved'::name, 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'authenticated or anon can still UPDATE products.quantity_reserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class rel
    CROSS JOIN LATERAL aclexplode(rel.relacl) AS acl
    WHERE rel.oid = 'public.products'::regclass
      AND acl.privilege_type = 'UPDATE'
      AND (
        acl.grantee = 0
        OR acl.grantee = v_anon
        OR acl.grantee = v_authenticated
        OR (
          acl.grantee <> 0
          AND acl.grantee <> v_authenticated
          AND pg_has_role('authenticated', acl.grantee, 'member')
        )
      )
  ) THEN
    RAISE EXCEPTION 'table-level UPDATE still reaches authenticated, anon, or PUBLIC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    CROSS JOIN LATERAL aclexplode(a.attacl) AS acl
    WHERE a.attrelid = 'public.products'::regclass
      AND a.attname = 'quantity'
      AND NOT a.attisdropped
      AND acl.privilege_type = 'UPDATE'
      AND (
        acl.grantee = 0
        OR acl.grantee = v_anon
        OR acl.grantee = v_authenticated
        OR (
          acl.grantee <> 0
          AND acl.grantee <> v_authenticated
          AND pg_has_role('authenticated', acl.grantee, 'member')
        )
      )
  ) THEN
    RAISE EXCEPTION 'column-level quantity UPDATE still reaches authenticated, anon, or PUBLIC';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.products'::regclass, 'cost'::name, 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.products'::regclass, 'image'::name, 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.products'::regclass, 'name'::name, 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.products'::regclass, 'INSERT') THEN
    RAISE EXCEPTION 'metadata update or product insert was removed';
  END IF;

  FOREACH v_name IN ARRAY v_keep LOOP
    IF NOT has_column_privilege('authenticated', 'public.products'::regclass, v_name::name, 'UPDATE') THEN
      RAISE EXCEPTION 'authenticated lost UPDATE on %', v_name;
    END IF;
  END LOOP;

  IF has_column_privilege('service_role', 'public.products'::regclass, 'image'::name, 'UPDATE')
     IS DISTINCT FROM v_service_image THEN
    RAISE EXCEPTION 'service_role image update privilege changed';
  END IF;
END;
$quantity_lock$;

CREATE OR REPLACE FUNCTION public.products_reject_nonzero_quantity_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.quantity IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Direct product quantity insert is not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.products_reject_nonzero_quantity_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_products_reject_nonzero_quantity_insert ON public.products;
CREATE TRIGGER trg_products_reject_nonzero_quantity_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.products_reject_nonzero_quantity_insert();

DO $quantity_trigger_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.products'::regclass
      AND t.tgname = 'trg_products_reject_nonzero_quantity_insert'
      AND NOT t.tgisinternal
      AND p.proname = 'products_reject_nonzero_quantity_insert'
      AND NOT p.prosecdef
      AND (t.tgtype & 1) = 1
      AND (t.tgtype & 2) = 2
      AND (t.tgtype & 4) = 4
      AND (t.tgtype & 16) = 0
  ) THEN
    RAISE EXCEPTION 'quantity insert trigger is not BEFORE INSERT only';
  END IF;
END;
$quantity_trigger_check$;

SELECT p.proname,
       r.rolname AS owner,
       p.prosecdef,
       r.rolsuper,
       has_column_privilege('authenticated', 'public.products'::regclass, 'quantity'::name, 'UPDATE') AS authenticated_quantity_update,
       has_column_privilege('authenticated', 'public.products'::regclass, 'cost'::name, 'UPDATE') AS authenticated_cost_update,
       has_column_privilege('authenticated', 'public.products'::regclass, 'image'::name, 'UPDATE') AS authenticated_image_update,
       has_column_privilege('service_role', 'public.products'::regclass, 'image'::name, 'UPDATE') AS service_role_image_update
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_product_with_opening_stock',
    'execute_inventory_transaction',
    'reverse_inventory_action',
    'import_receipt_confirm',
    'import_receipt_correct'
  )
ORDER BY p.proname;

COMMIT;
