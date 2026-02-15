

# Fix SubscriptionGuard Blocking Active Users

## Problem Summary
Three bugs prevent active subscribers from accessing guarded pages:

1. **DB check constraint** only allows `active`, `cancelled`, `expired` -- the code tries to insert `trial` status which violates the constraint
2. **Guard condition bug** on line 76: `if (isSubscriptionActive && isTrialValid)` requires BOTH to be true, but `isTrialValid` is always `false` for `status='active'` users. This means active paying users are always blocked.
3. **Loading race condition**: The guard treats "still loading" as "no subscription" and immediately tries to create a trial row

## Part A -- Database Fix

### 1. Add `trial` to the check constraint
The current constraint is: `status IN ('active', 'cancelled', 'expired')`. We need to add `'trial'` so trial subscriptions can be created.

```sql
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT user_subscriptions_status_check;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active', 'trial', 'cancelled', 'expired'));
```

No other DB changes needed -- RLS policies and unique constraint on `user_id` already exist and are correct.

## Part B -- Frontend Fixes

### 2. Fix `useSubscription.tsx`
- Expose `isLoading` state properly
- Fix `isSubscriptionActive` to correctly handle `active` status (it already does, the bug is in the guard)
- Add a check in `createTrialSubscription` to verify no existing row before inserting

### 3. Fix `SubscriptionGuard.tsx` (the main bug)
- **Line 76**: Change `if (isSubscriptionActive && isTrialValid)` to just `if (isSubscriptionActive)` -- active subscribers should pass through without needing trial validation
- **Line 41**: Add `isLoading` check -- only attempt trial creation AFTER loading completes and subscription is confirmed null
- Add a `useRef` guard to prevent multiple trial creation attempts
- Show a loading spinner while subscription data is being fetched

### Fixed Guard Logic Flow:

```text
1. If isLoading -> show spinner
2. If !requiresSubscription -> show children
3. If isSubscriptionActive -> show children (with trial banner if applicable)
4. If user exists AND no subscription AND not already creating -> create trial once
5. Otherwise -> show "subscription required" screen
```

## Files Changed

| File | Change |
|---|---|
| DB migration | Add `trial` to status check constraint |
| `src/hooks/useSubscription.tsx` | Add existing-row check before trial insert |
| `src/components/subscription/SubscriptionGuard.tsx` | Fix gate condition, add loading state, add ref guard |

## Verification

After implementation:
- User `lidortzafriri@gmail.com` (status=`active`, plan=Pro) should see `/settings/whatsapp` without being blocked
- No repeated POST requests to `user_subscriptions` in console
- `subscriptionStatus` should show `active` (not `undefined`)
