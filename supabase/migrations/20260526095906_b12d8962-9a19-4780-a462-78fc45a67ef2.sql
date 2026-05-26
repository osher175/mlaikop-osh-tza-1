ALTER VIEW public.payment_sessions_live SET (security_invoker = on);
ALTER VIEW public.billing_events_live SET (security_invoker = on);