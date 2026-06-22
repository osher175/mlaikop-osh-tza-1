
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS rate_limit_per_min integer NOT NULL DEFAULT 60;

ALTER TABLE public.api_keys
  DROP CONSTRAINT IF EXISTS api_keys_scope_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_scope_check CHECK (scope IN ('public','retail_iq'));

CREATE INDEX IF NOT EXISTS idx_api_key_usage_log_key_created
  ON public.api_key_usage_log (api_key_id, created_at DESC);
