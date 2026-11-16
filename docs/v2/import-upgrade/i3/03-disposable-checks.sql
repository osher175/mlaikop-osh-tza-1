-- DISPOSABLE DATABASE ONLY.
-- Refuses unless this session has:
--   SET i3.disposable_database = 'authorized';
-- Apply 01-import-wizard-commit.UNAPPLIED.sql on that database first.
-- This script rolls back. Never point it at production.

DO $refuse$
BEGIN
  IF current_setting('i3.disposable_database', true) IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'I3 disposable checks refused. Set i3.disposable_database = ''authorized'' on a disposable database.';
  END IF;
END;
$refuse$;

BEGIN;

DO $checks$
DECLARE
  v_prosecdef boolean;
  v_prosrc text;
  v_business uuid := gen_random_uuid();
  v_other_business uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_owner uuid;
BEGIN
  IF to_regclass('public.import_tire_identity') IS NULL
     OR to_regproc('public.import_wizard_commit(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'I3 wizard migration is not loaded on this disposable database';
  END IF;

  SELECT prosecdef, prosrc INTO v_prosecdef, v_prosrc
  FROM pg_proc
  WHERE oid = 'public.import_wizard_commit(jsonb)'::regprocedure;
  IF v_prosecdef THEN
    RAISE EXCEPTION 'import_wizard_commit must stay SECURITY INVOKER';
  END IF;
  IF v_prosrc ILIKE '%inventory_actions%' OR v_prosrc ILIKE '%UPDATE public.products%' THEN
    RAISE EXCEPTION 'import_wizard_commit must not post stock';
  END IF;
  IF has_function_privilege('anon', 'public.import_wizard_commit(jsonb)', 'EXECUTE')
     OR has_function_privilege('PUBLIC', 'public.import_wizard_commit(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'import_wizard_commit is executable by anon or public';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.import_wizard_commit(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute import_wizard_commit';
  END IF;
  IF has_function_privilege('authenticated', 'public.reject_import_only_supplier()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reject_import_only_supplier()', 'EXECUTE') THEN
    RAISE EXCEPTION 'local supplier guard must not be a client RPC';
  END IF;

  INSERT INTO public.businesses (id, name, owner_id)
  SELECT v_business, 'i3 disposable', id FROM auth.users LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disposable database has no auth user to own the fixture business';
  END IF;
  SELECT owner_id INTO v_owner FROM public.businesses WHERE id = v_business;

  INSERT INTO public.suppliers (business_id, name)
  VALUES (v_business, 'existing local');
  IF EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE business_id = v_business AND name = 'existing local'
      AND serves_import IS NOT FALSE
  ) OR EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE business_id = v_business AND name = 'existing local'
      AND serves_local IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Existing supplier defaults are not local-only';
  END IF;

  BEGIN
    INSERT INTO public.suppliers (business_id, name, serves_import, serves_local)
    VALUES (v_business, 'neither', false, false);
    RAISE EXCEPTION 'A supplier with both channels false was accepted';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  INSERT INTO public.products (id, business_id, name, quantity, created_by)
  VALUES (v_product, v_business, 'i3 tire', 4, v_owner);
  INSERT INTO public.import_tire_identity (
    product_id, business_id, brand_name, model_name, width_mm, aspect_ratio, rim_inch, identity_key, sku
  ) VALUES (
    v_product, v_business, 'Brand', 'Model', 205, 55, 16, 'brand|model|205|55|16.0||', 'SKU-A'
  );

  INSERT INTO public.products (id, business_id, name, quantity, created_by)
  VALUES (v_second, v_business, 'i3 tire two', 0, v_owner);
  BEGIN
    INSERT INTO public.import_tire_identity (
      product_id, business_id, brand_name, model_name, width_mm, aspect_ratio, rim_inch, identity_key, sku
    ) VALUES (
      v_second, v_business, 'Brand', 'Model', 205, 55, 16, 'brand|model|205|55|16.0||', 'SKU-B'
    );
    RAISE EXCEPTION 'Duplicate tire identity was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.import_tire_identity (
      product_id, business_id, brand_name, model_name, width_mm, aspect_ratio, rim_inch, identity_key, sku
    ) VALUES (
      v_second, v_business, 'Other', 'Model', 195, 65, 15, 'other|model|195|65|15.0||', 'SKU-A'
    );
    RAISE EXCEPTION 'Duplicate tire SKU was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  INSERT INTO public.businesses (id, name, owner_id)
  VALUES (v_other_business, 'i3 other', v_owner);
  BEGIN
    INSERT INTO public.import_tire_identity (
      product_id, business_id, brand_name, model_name, width_mm, aspect_ratio, rim_inch, identity_key
    ) VALUES (
      v_product, v_other_business, 'Brand', 'Model', 205, 55, 16, 'other-key'
    );
    RAISE EXCEPTION 'Cross-business tire identity was accepted';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      NULL;
  END;
END;
$checks$;

ROLLBACK;
