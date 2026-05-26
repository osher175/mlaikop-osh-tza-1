UPDATE public.billing_events
SET metadata = metadata || jsonb_build_object('is_test', true)
WHERE metadata->>'session_id' = '11111111-2222-3333-4444-555555555555'
  AND COALESCE((metadata->>'is_test')::boolean, false) = false;