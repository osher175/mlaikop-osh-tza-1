-- Scheduled job: Expire trial subscriptions after 30 days

update public.user_subscriptions_new
set status = 'expired'
where status = 'active'
  and type = 'trial'
  and trial_ends_at < now(); 