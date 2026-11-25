-- READ ONLY. Do not apply club-api-scope.UNAPPLIED.sql with this file.
-- Confirms the live api_keys scope check and that no club database function exists.
-- Edge functions are not visible here; list them with the Supabase functions API.

SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conname = 'api_keys_scope_check';

SELECT p.proname
FROM pg_proc p
WHERE position('club' in p.proname) > 0;

SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.import_orders'::regclass
  AND contype = 'c'
  AND position('ordered' in pg_get_constraintdef(oid)) > 0;

SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'import_orders'
  AND column_name IN ('status', 'commercial_status', 'confirmed_at');
