-- UNAPPLIED. Do not copy into supabase/migrations. Do not execute on production.
-- import_receipt_confirm already records receipt_shortage_recorded and
-- receipt_overage_recorded. The event check omitted those values, so a
-- partial receipt rolled back and added no stock.
-- This file only widens the existing check. It keeps every event type the
-- database already allows, including cost_finalized where that type exists.
-- It does not replace import_receipt_confirm and does not apply the i2 schema.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $widen$
DECLARE
  v_def text;
  v_types text[] := ARRAY[]::text[];
  v_match text[];
BEGIN
  IF to_regclass('public.import_events') IS NULL THEN
    RAISE EXCEPTION 'import_events is missing';
  END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conname = 'import_events_event_type_check'
    AND conrelid = 'public.import_events'::regclass;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'import_events_event_type_check is missing';
  END IF;
  IF position('receipt_shortage_recorded' in v_def) > 0
     AND position('receipt_overage_recorded' in v_def) > 0 THEN
    RETURN;
  END IF;
  FOR v_match IN SELECT regexp_matches(v_def, '''([a-z0-9_]+)''', 'g')
  LOOP
    IF NOT (v_match[1] = ANY (v_types)) THEN
      v_types := v_types || ARRAY[v_match[1]];
    END IF;
  END LOOP;
  IF cardinality(v_types) < 10 THEN
    RAISE EXCEPTION 'import event check was not readable: %', v_def;
  END IF;
  IF NOT ('receipt_shortage_recorded' = ANY (v_types)) THEN
    v_types := v_types || ARRAY['receipt_shortage_recorded'];
  END IF;
  IF NOT ('receipt_overage_recorded' = ANY (v_types)) THEN
    v_types := v_types || ARRAY['receipt_overage_recorded'];
  END IF;
  EXECUTE 'ALTER TABLE public.import_events DROP CONSTRAINT import_events_event_type_check';
  EXECUTE format(
    'ALTER TABLE public.import_events ADD CONSTRAINT import_events_event_type_check CHECK (event_type = ANY (%L::text[]))',
    v_types
  );
END;
$widen$;

COMMIT;
