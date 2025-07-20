-- Enable RLS on products table
alter table public.products enable row level security;

-- Add select policy: Allow only users with active subscriptions
create policy "Allow only users with active subscriptions"
on public.products
for select
to authenticated
using (
  exists (
    select 1 from public.user_subscriptions_new
    where user_subscriptions_new.user_id = auth.uid()
      and status = 'active'
      and (type != 'trial' or trial_ends_at > now())
  )
); 