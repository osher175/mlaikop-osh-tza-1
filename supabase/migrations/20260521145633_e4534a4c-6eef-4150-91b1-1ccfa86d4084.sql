
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note text;

CREATE INDEX IF NOT EXISTS idx_businesses_is_test ON public.businesses(is_test) WHERE is_test = true;

UPDATE public.businesses
SET is_test = true,
    admin_note = COALESCE(admin_note, '') ||
      CASE WHEN admin_note IS NULL OR admin_note = '' THEN '' ELSE E'\n' END ||
      '[QA] Billing/read-only QA business. Do not include in customer analytics. Created/used for billing gate scenario testing.'
WHERE id = 'b50d6eae-cfaa-478f-9aad-e5890438deff'
  AND name = 'QA Billing Test Business';

UPDATE public.businesses
SET is_test = true
WHERE name LIKE 'QA %' AND is_test = false;
