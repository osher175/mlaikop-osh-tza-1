-- UNAPPLIED. Do not execute until a separate approval.
-- Intentionally outside supabase/migrations.
--
-- Adds the club read scope to the existing api_keys check.
-- Depends on public.api_keys and api_keys_scope_check from
-- supabase/migrations/20260622070529_8cf83bb7-65c0-43a6-9e2c-979b592987aa.sql.
-- Does not create products, tire specs, reservations, or grants.
-- A club key cannot be inserted until this constraint is applied.
-- Deploy supabase/functions/club-api after or before this change;
-- keys with scope public or retail_iq stay valid.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_scope_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_scope_check CHECK (scope IN ('public', 'retail_iq', 'club'));

COMMIT;
