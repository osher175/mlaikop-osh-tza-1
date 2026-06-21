-- API Keys for external read-only access to Mlaiko data
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_business ON public.api_keys(business_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owners/admins of the business can manage their own keys
CREATE POLICY "Business owners can view their api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role_or_higher('admin'::user_role)
  );

CREATE POLICY "Business owners can create api keys"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
      OR public.has_role_or_higher('admin'::user_role)
    )
  );

CREATE POLICY "Business owners can update (revoke) their api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role_or_higher('admin'::user_role)
  );

CREATE POLICY "Business owners can delete their api keys"
  ON public.api_keys FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role_or_higher('admin'::user_role)
  );

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API key usage log
CREATE TABLE public.api_key_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  status_code integer,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_key_time ON public.api_key_usage_log(api_key_id, created_at DESC);
CREATE INDEX idx_api_usage_business ON public.api_key_usage_log(business_id, created_at DESC);

GRANT SELECT ON public.api_key_usage_log TO authenticated;
GRANT ALL ON public.api_key_usage_log TO service_role;

ALTER TABLE public.api_key_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their api usage log"
  ON public.api_key_usage_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_id = auth.uid())
    OR public.has_role_or_higher('admin'::user_role)
  );