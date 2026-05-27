
-- QA TEST 1: transition payment_link_created -> paid (should fire trigger once)
UPDATE public.payment_sessions
SET status='paid', completed_at=now()
WHERE id='11111111-2222-3333-4444-555555555555';

-- QA TEST 2: idempotency — paid -> paid again (trigger WHEN clause should block)
UPDATE public.payment_sessions
SET status='paid'
WHERE id='11111111-2222-3333-4444-555555555555';
