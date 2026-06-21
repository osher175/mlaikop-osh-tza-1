# CODE FREEZE — Subscription Lock & Grow Payment Flow

**Status:** FROZEN. Do not modify any item listed below without explicit written approval from the project owner.

## Why
The subscription lock and Grow payment flow are stable, revenue-critical, and integrated with external systems (Grow checkout, Make/n8n webhooks, Supabase triggers). Unapproved changes risk breaking billing for live customers.

## Rules
- **No** refactor, redesign, rename, or optimization of the items below.
- **No** database schema changes to subscription / `payment_sessions` / plans / trials / `user_subscriptions`.
- **No** RLS policy changes on the tables below unless explicitly requested.
- **No** changes to checkout URLs, webhook payload handling, or payment status transitions.
- **No** changes to admin bypass behavior.
- **No** changes to UI text, routing, redirects, banners, or guards related to subscription/payment status.

### Allowed
- Critical bug fixes — only if explicitly requested.
- Security fixes — only if they do not alter the existing working behavior.
- Other product features may continue, but **must not** affect this surface.

Any PR touching a listed item must reference this document and have explicit approval.

---

## Frozen surface

### Frontend — guards, hooks, UI
- `src/components/subscription/SubscriptionGuard.tsx`
- `src/components/billing/BillingReadOnlyBanner.tsx`
- `src/components/billing/BillingLockedButton.tsx`
- `src/components/ProtectedFeature.tsx` (subscription-related portions)
- `src/hooks/useSubscription.tsx`
- `src/hooks/useBusinessBillingStatus.tsx`
- `src/hooks/useRequireCanWriteAction.tsx`
- `src/hooks/useOwnerRole.tsx` (parts feeding billing decisions)

### Frontend — pages / routing
- `src/pages/Subscribe.tsx`
- `src/pages/Subscriptions.tsx`
- `mlaikop-osh-tza-1-main/src/pages/Subscriptions.tsx`
- `src/components/SubscriptionPlans.tsx`
- Any `/subscribe`, `/subscriptions`, `?expired=true` redirects in router setup

### Payment payload builder
- `src/lib/payments/buildGrowSubscriptionPayload.ts`
- `src/lib/payments/types.ts`

### Edge functions (Grow / Make / webhooks)
- `supabase/functions/grow-create-subscription/index.ts`
- `supabase/functions/grow-start-checkout/index.ts`
- `supabase/functions/grow-update-session-status/index.ts`
- `supabase/functions/_shared/billing.ts`

### Database (frozen — no migrations without approval)
- Tables: `subscription_plans`, `user_subscriptions`, `payment_sessions`, `billing_events`
- Functions / triggers: `business_billing_status`, `activate_subscription_on_paid` (trigger + function), trial creation RPC, `require_premium`
- RLS policies on the tables above

### Admin bypass
- Admin bypass logic inside `useBusinessBillingStatus` and `SubscriptionGuard` (`userRole === 'admin'` branches)

---

## Marker comment
Every frozen source file carries this header:

```
// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
```
