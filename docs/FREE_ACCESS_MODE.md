# Free Access Mode — Mlaiko

**Status:** ENABLED (temporary). Subscription enforcement is suspended; the billing system is intact.

## 1. Previous subscription enforcement

Three enforcement layers existed:

| Layer | Mechanism | Effect |
| --- | --- | --- |
| Route access | `SubscriptionGuard` wrapping all business routes in `src/App.tsx` | Rendered the blocking card `נדרש מנוי פעיל` / `תקופת הניסיון הסתיימה` instead of the app |
| Write actions | `useRequireCanWriteAction` → `useBusinessBillingStatus` | Read-only mode, blocked buttons, toast + `/subscribe` redirect |
| Backend | `requireActiveBusinessOrRespond` in `supabase/functions/_shared/billing.ts` + cron functions | 402 responses per business |

### Exact cause of the "נדרש מנוי פעיל" screen

`src/components/subscription/SubscriptionGuard.tsx` granted access only via:

```ts
if (businessId && businessCanWrite) { return <>{children}</>; }
// otherwise → blocking card with "נדרש מנוי פעיל"
```

The global kill-switch `BILLING_LOCK_ENABLED = false` already forced `businessCanWrite = true`
in `useBusinessBillingStatus`, **but it did not supply `businessId`**. Any user whose
`business_id` was missing, still resolving, or not returned by
`get_user_business_context` fell through to the blocking card — a subscription
error screen shown for a non-subscription reason. That residual path was the
last remaining enforcement blocker.

Backend gates were already bypassed (`BILLING_LOCK_ENABLED !== 'true'`).

## 2. Implementation

A single explicit flag, derived from the existing kill-switch:

`src/lib/billing/featureFlag.ts`
```ts
export const BILLING_LOCK_ENABLED = false;
export const FREE_ACCESS_MODE = !BILLING_LOCK_ENABLED;
```

`src/components/subscription/SubscriptionGuard.tsx`
- Early return of `children` when `FREE_ACCESS_MODE` is true, before the
  `businessId && businessCanWrite` decision and before the blocking card.
- Trial auto-creation effect is skipped while the mode is on, so no
  subscription rows are created while enforcement is suspended.

### Files modified (2)

1. `src/lib/billing/featureFlag.ts` — added `FREE_ACCESS_MODE` + documentation.
2. `src/components/subscription/SubscriptionGuard.tsx` — early bypass, skip trial creation.

Both are HARD-FREEZE files under `CODE_FREEZE_SUBSCRIPTION.md`. The edits were
authorized by the task and are the minimum required: the flag must live in the
central billing config, and the guard is the only component that renders the
blocking screen. No other billing file, route, table, Edge Function, webhook or
UI was touched.

## 3. What Free Access Mode bypasses

- Active-subscription requirement for route access
- Trial-expiration blocking and the expired-trial screen
- Cancelled / past_due / incomplete / none billing states as access blockers
- Billing read-only mode and blocked write actions
- Trial auto-creation for new owners
- Backend per-business billing gates (already bypassed via the env kill-switch)

## 4. What it explicitly does NOT bypass

- Authentication — `ProtectedRoute` / `useAuth` unchanged
- Business membership — `useBusinessAccess` / `get_user_business_context` unchanged
- Tenant isolation — all `business_id` scoping unchanged
- Roles and permissions — `allowedRoles` per route unchanged
- Admin authorization — `has_role_or_higher`, admin routes unchanged
- RLS — no policy, grant or migration changed
- Analytics correctness, inventory logic, procurement logic

## 5. Subscription data

No data was altered. No bulk updates, no synthetic subscriptions, no
`active = true` writes, no changes to payment sessions, payment history, plans
or subscription dates. The database continues to reflect real billing state; the
bypass is purely application-level.

## 6. Verification

- Typecheck: PASS
- Lint: baseline unchanged
- Production build: PASS
- Smoke: Dashboard, Inventory, Add Product, Suppliers, Procurement, Reports, Settings

| Scenario | Expected | Result |
| --- | --- | --- |
| Authenticated business user, no subscription | Full access | PASS |
| Authenticated business user, expired trial | Full access | PASS |
| User with active subscription | Full access | PASS |
| Unauthenticated user | Redirect to `/auth` | PASS (unchanged) |
| Cross-tenant access attempt | Denied | PASS (unchanged — RLS) |
| Platform admin | Unchanged | PASS |

## 7. Turning Free Access Mode ON

Already on. `src/lib/billing/featureFlag.ts`: `BILLING_LOCK_ENABLED = false`.

## 8. Restoring paid enforcement later

1. `src/lib/billing/featureFlag.ts` → set `BILLING_LOCK_ENABLED = true`
   (`FREE_ACCESS_MODE` becomes `false` automatically).
2. Set the Supabase Edge Function secret `BILLING_LOCK_ENABLED = "true"` to
   re-arm the backend gates.
3. Deploy. No rebuild of the billing architecture is required — guards, hooks,
   Grow checkout, webhooks, the `activate_subscription_on_paid` trigger and all
   subscription tables remained in place and functional.
4. Note on restore: businesses whose owners never had a trial row created during
   the free period will be evaluated as `none` and will see the subscription
   screen. If a grace trial is wanted at that point, decide it deliberately —
   this implementation intentionally does not fabricate trial rows.
