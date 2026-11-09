-- LOCAL REVIEW PROPOSAL ONLY. NOT APPLIED. Separate execution approval required.
-- Independent ACL hardening ONLY; does not fix membership or inventory identity.
-- Never copy into supabase/migrations; use the migration tool after approval.
-- Requires fresh evidence, trusted-execution review, backup and isolated validation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Stabilize the product relation during the approved maintenance transaction.
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;

DO $acl_hardening$
DECLARE
  v_product regclass := to_regclass('public.products');
  v_reverse regprocedure := to_regprocedure('public.reverse_inventory_action(uuid)');
  v_columns text;
  v_before jsonb;
  v_after jsonb;
  v_reverse_definition text;
  v_role text;
  v_cap text;
BEGIN
  IF v_product IS NULL OR v_reverse IS NULL THEN
    RAISE EXCEPTION 'Required product relation or exact reversal signature missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=v_product AND relkind='r' AND relrowsecurity) THEN
    RAISE EXCEPTION 'Product relation kind or RLS baseline changed';
  END IF;
  SELECT pg_get_functiondef(v_reverse) INTO v_reverse_definition;

  -- Preserve EFFECTIVE authenticated/service access, including PUBLIC/inheritance.
  -- If a PUBLIC revoke would remove legitimate access, abort rather than widen grants.
  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.role_name,s.object_name,s.capability)
  INTO v_before FROM (
    SELECT r.role_name,'products'::text AS object_name,c.capability,
      has_table_privilege(r.role_name,v_product,c.capability) AS allowed
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) c(capability)
    UNION ALL
    SELECT r.role_name,'products.'||a.attname,c.capability,
      has_column_privilege(r.role_name,v_product,a.attname,c.capability)
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) c(capability)
    CROSS JOIN pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT r.role_name,'reverse_inventory_action(uuid)','EXECUTE',
      has_function_privilege(r.role_name,v_reverse,'EXECUTE')
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
  ) s;

  REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.products FROM PUBLIC,anon;
  SELECT string_agg(format('%I',attname),', ' ORDER BY attnum) INTO v_columns
  FROM pg_attribute WHERE attrelid=v_product AND attnum>0 AND NOT attisdropped;
  IF v_columns IS NULL THEN RAISE EXCEPTION 'Product columns missing'; END IF;
  EXECUTE format('REVOKE INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.products FROM PUBLIC,anon',
    v_columns,v_columns,v_columns);
  REVOKE EXECUTE ON FUNCTION public.reverse_inventory_action(uuid) FROM PUBLIC,anon;

  FOREACH v_cap IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('anon',v_product,v_cap) THEN
      RAISE EXCEPTION 'Effective anonymous product capability remains: %',v_cap;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
      AND (has_column_privilege('anon',v_product,a.attname,'INSERT')
        OR has_column_privilege('anon',v_product,a.attname,'UPDATE')
        OR has_column_privilege('anon',v_product,a.attname,'REFERENCES'))) THEN
    RAISE EXCEPTION 'Inherited anonymous column capabilities remain; review role graph';
  END IF;
  IF has_function_privilege('anon',v_reverse,'EXECUTE') THEN
    RAISE EXCEPTION 'Inherited anonymous reversal execution remains';
  END IF;

  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.role_name,s.object_name,s.capability)
  INTO v_after FROM (
    SELECT r.role_name,'products'::text AS object_name,c.capability,
      has_table_privilege(r.role_name,v_product,c.capability) AS allowed
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) c(capability)
    UNION ALL
    SELECT r.role_name,'products.'||a.attname,c.capability,
      has_column_privilege(r.role_name,v_product,a.attname,c.capability)
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) c(capability)
    CROSS JOIN pg_attribute a
    WHERE a.attrelid=v_product AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT r.role_name,'reverse_inventory_action(uuid)','EXECUTE',
      has_function_privilege(r.role_name,v_reverse,'EXECUTE')
    FROM (VALUES ('authenticated'),('service_role')) r(role_name)
  ) s;
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'Authenticated/service effective privileges changed; transaction must abort';
  END IF;
  IF pg_get_functiondef(v_reverse) IS DISTINCT FROM v_reverse_definition THEN
    RAISE EXCEPTION 'Reversal definition changed during ACL preparation';
  END IF;
  -- No DML, policy/function replacement, default ACL edits or new grants.
END;
$acl_hardening$;
COMMIT;