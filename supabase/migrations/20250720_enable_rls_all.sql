-- Enable RLS on businesses, inventory_actions, and suppliers tables
alter table public.businesses enable row level security;
alter table public.inventory_actions enable row level security;
alter table public.suppliers enable row level security;

-- Add select policy for businesses
create policy "Allow only active subscribers (businesses)"
on public.businesses
for select
to authenticated
using (
  exists (
    select 1 from public.user_subscriptions_new
    where user_id = auth.uid()
      and status = 'active'
      and (type != 'trial' or trial_ends_at > now())
  )
);

-- Add select policy for inventory_actions
create policy "Allow only active subscribers (inventory_actions)"
on public.inventory_actions
for select
to authenticated
using (
  exists (
    select 1 from public.user_subscriptions_new
    where user_id = auth.uid()
      and status = 'active'
      and (type != 'trial' or trial_ends_at > now())
  )
);

-- Add select policy for suppliers
create policy "Allow only active subscribers (suppliers)"
on public.suppliers
for select
to authenticated
using (
  exists (
    select 1 from public.user_subscriptions_new
    where user_id = auth.uid()
      and status = 'active'
      and (type != 'trial' or trial_ends_at > now())
  )
); 