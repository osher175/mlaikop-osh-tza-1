-- M3: Restrict automation_outbox INSERT to service_role only
DROP POLICY IF EXISTS "System can insert outbox events" ON public.automation_outbox;

CREATE POLICY "Service role can insert outbox events"
ON public.automation_outbox
FOR INSERT
TO service_role
WITH CHECK (true);