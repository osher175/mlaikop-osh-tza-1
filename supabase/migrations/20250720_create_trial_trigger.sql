-- 1. Function: create_trial_subscription
create or replace function public.create_trial_subscription()
returns trigger as $$
begin
  insert into public.user_subscriptions_new (
    user_id,
    plan,
    status,
    type,
    started_at,
    trial_ends_at
  )
  values (
    new.id,
    'free_trial',            -- adjust the plan name if needed
    'active',
    'trial',
    now(),
    now() + interval '30 days'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Trigger on auth.users
drop trigger if exists after_user_signup_trial on auth.users;

create trigger after_user_signup_trial
after insert on auth.users
for each row
execute function public.create_trial_subscription(); 