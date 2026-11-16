-- UNAPPLIED and BLOCKED until this preflight matches the live database.
-- Do not copy into supabase/migrations and do not run on production.
--
-- Two AFTER UPDATE triggers call notify_out_of_stock. The verified live body
-- inserts a stock_approval_requests row on a positive-to-zero crossing and
-- does not look for an existing request. This file keeps both triggers and
-- makes the second trigger in the same statement see the first insert.
-- A later statement uses a new statement_timestamp(), so a later genuine
-- return to zero is still recorded. Concurrent updates of one product are
-- serialized by the product row lock, so they do not both observe the same
-- positive-to-zero transition.
-- It does not drop a trigger, because the live trigger names were not
-- re-read here and one of them may carry a side effect the other lacks.
--
-- The preflight aborts when the live body contains an HTTP call, when the
-- trigger count is not two, or when created_at has no default. In those
-- cases the function is left unchanged.

BEGIN;

DO $preflight$
DECLARE
  v_def text;
  v_triggers integer;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'notify_out_of_stock';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: notify_out_of_stock is missing';
  END IF;
  IF v_def ILIKE '%http_post%' OR v_def ILIKE '%clever-service%' THEN
    RAISE EXCEPTION 'BLOCKED: notify_out_of_stock still performs an external call';
  END IF;
  IF v_def NOT ILIKE '%INSERT INTO public.stock_approval_requests%' THEN
    RAISE EXCEPTION 'BLOCKED: notify_out_of_stock body is not the known insert';
  END IF;

  SELECT count(*) INTO v_triggers
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.products'::regclass
    AND NOT t.tgisinternal
    AND p.proname = 'notify_out_of_stock';

  IF v_triggers IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'BLOCKED: expected 2 notify_out_of_stock triggers, found %', v_triggers;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE a.attrelid = 'public.stock_approval_requests'::regclass
      AND a.attname = 'created_at'
      AND NOT a.attisdropped
      AND t.typname IN ('timestamptz', 'timestamp')
  ) THEN
    RAISE EXCEPTION 'BLOCKED: stock_approval_requests.created_at is missing';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.notify_out_of_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.stock_approval_requests
      WHERE product_id = NEW.id
        AND created_at = statement_timestamp()
    ) THEN
      INSERT INTO public.stock_approval_requests (
        product_id,
        supplier_id,
        product_name,
        quantity,
        created_at
      ) VALUES (
        NEW.id,
        NEW.supplier_id,
        NEW.name,
        NEW.quantity,
        statement_timestamp()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
