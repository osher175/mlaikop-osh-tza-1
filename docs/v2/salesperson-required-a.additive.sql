-- UNAPPLIED. DO NOT EXECUTE until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Migration A of 2. Apply this before any frontend starts sending
-- inventory_actions.salesperson_employee_id.
-- Do not apply docs/v2/salesperson-required-b.enforcement.sql in the same step.
-- Do not apply docs/v2/salesperson-required.UNAPPLIED.sql.
--
-- Adds a nullable salesperson column. Existing inserts keep working because
-- they omit the column and MATCH SIMPLE does not check a null salesperson.
-- This file does not replace complete_quick_sale and does not reject a sale.
-- It does not update, delete, or backfill any row.
--
-- The foreign key is validated in this transaction. NOT VALID is not used:
-- a brand-new nullable column has no existing non-null values to skip, and
-- one transaction is easier to roll back than a later VALIDATE step.
-- The index is ordinary, not CONCURRENTLY, because CONCURRENTLY cannot run
-- inside this transaction. Quote "timestamp": it is also a type name.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preconditions$
DECLARE
  v_action_business text;
  v_action_business_not_null boolean;
  v_action_timestamp text;
  v_employee_business text;
  v_employee_business_not_null boolean;
  v_employee_id text;
  v_employee_id_not_null boolean;
  v_salesperson text;
  v_salesperson_not_null boolean;
  v_fk_local text[];
  v_fk_remote text[];
  v_fk_delete "char";
  v_index_cols text[];
  v_index_pred text;
  v_index_unique boolean;
BEGIN
  IF to_regclass('public.employees') IS NULL
     OR to_regclass('public.inventory_actions') IS NULL THEN
    RAISE EXCEPTION 'migration A requires public.employees and public.inventory_actions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'employees' AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_actions' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'employees or inventory_actions is missing row level security';
  END IF;

  SELECT t.typname, a.attnotnull INTO v_action_business, v_action_business_not_null
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.inventory_actions'::regclass
    AND a.attname = 'business_id' AND NOT a.attisdropped;
  SELECT t.typname INTO v_action_timestamp
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.inventory_actions'::regclass
    AND a.attname = 'timestamp' AND NOT a.attisdropped;
  SELECT t.typname, a.attnotnull INTO v_employee_business, v_employee_business_not_null
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.employees'::regclass
    AND a.attname = 'business_id' AND NOT a.attisdropped;
  SELECT t.typname, a.attnotnull INTO v_employee_id, v_employee_id_not_null
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.employees'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  IF v_action_business IS DISTINCT FROM 'uuid' OR v_action_business_not_null IS DISTINCT FROM true
     OR v_action_timestamp IS DISTINCT FROM 'timestamptz'
     OR v_employee_business IS DISTINCT FROM 'uuid' OR v_employee_business_not_null IS DISTINCT FROM true
     OR v_employee_id IS DISTINCT FROM 'uuid' OR v_employee_id_not_null IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'employee or inventory column types do not match the expected uuid/timestamptz contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.employees'::regclass
      AND c.contype IN ('u', 'p')
      AND (
        SELECT array_agg(a.attname::text ORDER BY k.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ) = ARRAY['business_id', 'id']::text[]
  ) THEN
    RAISE EXCEPTION 'employees needs a unique or primary key on (business_id, id)';
  END IF;

  SELECT t.typname, a.attnotnull INTO v_salesperson, v_salesperson_not_null
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.inventory_actions'::regclass
    AND a.attname = 'salesperson_employee_id' AND NOT a.attisdropped;
  IF v_salesperson IS NULL THEN
    ALTER TABLE public.inventory_actions
      ADD COLUMN salesperson_employee_id uuid NULL;
  ELSIF v_salesperson IS DISTINCT FROM 'uuid' OR v_salesperson_not_null IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'salesperson_employee_id exists but is not a nullable uuid';
  END IF;

  SELECT
    (
      SELECT array_agg(a.attname::text ORDER BY k.ord)
      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    ),
    (
      SELECT array_agg(a.attname::text ORDER BY k.ord)
      FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    ),
    c.confdeltype
  INTO v_fk_local, v_fk_remote, v_fk_delete
  FROM pg_constraint c
  WHERE c.conname = 'inventory_actions_salesperson_employee_fkey'
    AND c.conrelid = 'public.inventory_actions'::regclass
    AND c.contype = 'f';
  IF v_fk_local IS NULL THEN
    ALTER TABLE public.inventory_actions
      ADD CONSTRAINT inventory_actions_salesperson_employee_fkey
      FOREIGN KEY (business_id, salesperson_employee_id)
      REFERENCES public.employees (business_id, id)
      ON DELETE RESTRICT;
  ELSIF v_fk_local IS DISTINCT FROM ARRAY['business_id', 'salesperson_employee_id']::text[]
     OR v_fk_remote IS DISTINCT FROM ARRAY['business_id', 'id']::text[]
     OR v_fk_delete IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'inventory_actions_salesperson_employee_fkey exists with an unexpected definition';
  END IF;

  IF to_regclass('public.inventory_actions_salesperson_idx') IS NOT NULL THEN
    SELECT
      (
        SELECT array_agg(a.attname::text ORDER BY k.ord)
        FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
      ),
      pg_get_expr(ix.indpred, ix.indrelid),
      ix.indisunique
    INTO v_index_cols, v_index_pred, v_index_unique
    FROM pg_index ix
    JOIN pg_class ic ON ic.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE n.nspname = 'public'
      AND ic.relname = 'inventory_actions_salesperson_idx';
    IF v_index_unique IS DISTINCT FROM false
       OR v_index_cols IS DISTINCT FROM ARRAY['business_id', 'salesperson_employee_id', 'timestamp']::text[]
       OR replace(replace(coalesce(v_index_pred, ''), '(', ''), ')', '')
          IS DISTINCT FROM 'salesperson_employee_id IS NOT NULL' THEN
      RAISE EXCEPTION 'inventory_actions_salesperson_idx exists with an unexpected definition';
    END IF;
  ELSE
    CREATE INDEX inventory_actions_salesperson_idx
      ON public.inventory_actions (business_id, salesperson_employee_id, "timestamp")
      WHERE salesperson_employee_id IS NOT NULL;
  END IF;
END;
$preconditions$;

COMMENT ON COLUMN public.inventory_actions.salesperson_employee_id IS
  'Optional until migration B. NULL on historical sales and on writes that do not send it. Not inventory_actions.user_id. Never backfilled.';

-- BEFORE UPDATE only. Inserts, including legacy sales that omit this column,
-- do not fire it. An update that leaves the column unchanged still passes.
-- reverse_inventory_action updates reversed_at and reversed_by only.
CREATE OR REPLACE FUNCTION public.guard_inventory_sale_salesperson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $guard$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.salesperson_employee_id IS DISTINCT FROM OLD.salesperson_employee_id THEN
    RAISE EXCEPTION 'salesperson attribution is immutable and cannot be backfilled'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.guard_inventory_sale_salesperson() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_inventory_sale_salesperson ON public.inventory_actions;
CREATE TRIGGER trg_guard_inventory_sale_salesperson
  BEFORE UPDATE ON public.inventory_actions
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_sale_salesperson();

COMMIT;
