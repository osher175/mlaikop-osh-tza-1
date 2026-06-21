# CODE FREEZE — Subscription Lock & Grow Payment Flow

**Status:** FROZEN. Do not modify any item listed below without explicit written approval from the project owner.

## Why
The subscription lock and Grow payment flow are stable, revenue-critical, and integrated with external systems (Grow checkout, Make/n8n webhooks, Supabase triggers). Unapproved changes risk breaking billing for live customers.

## Rules
- **No** refactor, redesign, rename, or optimization of the items below.
- **No** database schema changes to subscription / `payment_sessions` / plans / trials / `user_subscriptions` / `billing_events`.
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

## Frozen surface (HARD FREEZE — billing-only files)

### Frontend — guards, banners, subscription hooks
- `src/components/subscription/SubscriptionGuard.tsx`
- `src/components/billing/BillingReadOnlyBanner.tsx`
- `src/components/billing/BillingLockedButton.tsx`
- `src/components/ProtectedFeature.tsx`
- `src/components/SubscriptionPlans.tsx`
- `src/hooks/useSubscription.tsx`
- `src/hooks/useBusinessBillingStatus.tsx`
- `src/hooks/useRequireCanWriteAction.tsx`
- `src/hooks/useOwnerRole.tsx`

### Frontend — subscription pages
- `src/pages/Subscribe.tsx`
- `src/pages/Subscriptions.tsx`
- `mlaikop-osh-tza-1-main/src/pages/Subscriptions.tsx`

### Payment payload builder
- `src/lib/payments/buildGrowSubscriptionPayload.ts`
- `src/lib/payments/types.ts`

### Edge functions (Grow / Make / webhooks)
- `supabase/functions/grow-create-subscription/index.ts`
- `supabase/functions/grow-start-checkout/index.ts`
- `supabase/functions/grow-update-session-status/index.ts`
- `supabase/functions/_shared/billing.ts`

---

## Soft-freeze (shared infra — billing-related portions only)

These files are part of the subscription/payment execution path but are also used elsewhere in the app. **The subscription/billing/admin-bypass code paths inside them are frozen.** Unrelated changes (new auth features, layout tweaks not affecting `BillingReadOnlyBanner`, new routes outside the guarded tree) are still allowed — but any change touching billing logic, RPC contracts, or guard wiring requires explicit approval.

- `src/App.tsx` — defines `<SubscriptionGuard>` wrapper, `/subscribe`, `/subscriptions` routes, and the admin-bypass routing comment. **Do not move routes in/out of the guard.**
- `src/components/layout/MainLayout.tsx` — renders `BillingReadOnlyBanner`. Do not remove or conditionally hide the banner.
- `src/components/ProtectedRoute.tsx` — gate before `SubscriptionGuard`; checks `profiles.is_active`. Do not change auth-gating order.
- `src/hooks/useAuth.tsx` — auth state is the root of every subscription decision. Do not change session shape or redirect behavior used by the guard.
- `src/hooks/useUserRole.tsx` — `userRole === 'admin'` is the **admin bypass** mechanism. Do not change role return values.
- `src/hooks/useBusinessAccess.tsx` — feeds `SubscriptionGuard` and `useBusinessBillingStatus` via `get_user_business_context` RPC. Do not change RPC contract or return shape.
- `src/hooks/useActiveBusiness.tsx` — supplies `business_id` to checkout. Do not change selection logic.
- `src/lib/formatCurrency.ts` — used in `Subscribe.tsx` for plan pricing. Keep ILS/he-IL formatting stable.
- `src/integrations/supabase/client.ts` — Supabase client; do not change credential wiring.
- `src/integrations/supabase/types.ts` — generated; never edit by hand.

---

## Database (frozen — no migrations without approval)

### Tables
- `subscription_plans`, `user_subscriptions`, `payment_sessions`, `billing_events`

### Functions / triggers / RPCs
- `business_billing_status`
- `activate_subscription_on_paid` (trigger + function)
- `require_premium`
- `get_user_business_context` (used by trial bootstrap path)
- Trial creation RPC invoked by `useSubscription.createTrialSubscription`

### RLS policies
- All policies on the four tables above

### Existing migrations that established this surface (do NOT amend)
`20250617182328`, `20250617201608`, `20250617201648`, `20250708102549`, `20250716143152`, `20250720183552`, `20260117203017`, `20260117203210`, `20260117203420`, `20260214205127`, `20260215172525`, `20260510181138`, `20260510182705`, `20260521084813`, `20260521085402`, `20260521091510`, `20260521144842`, `20260521145056`, `20260526094538`, `20260526095206`, `20260526095726`, `20260526095906`, `20260526100041`, `20260527110342`, `20260527111540`, `20260527111656`, `20260622183731`.

---

## Marker comment
Every frozen / soft-frozen source file carries this header:

```
// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
```

---

## Audit summary (last run)

- **Total tagged source files:** 26
  - Hard freeze: 18
  - Soft freeze (shared infra): 8
- **Frozen DB objects:** 4 tables, 5 functions/triggers/RPCs, 27 migrations referenced.
- **Unfrozen files still influencing the system:** none — all execution-path files identified by the audit are now tagged.

### Dependency map (frozen file → internal deps)
| File | Internal deps |
|---|---|
| `SubscriptionGuard.tsx` | `useSubscription`, `useBusinessBillingStatus`, `useBusinessAccess`, `useAuth`, `useUserRole` |
| `BillingReadOnlyBanner.tsx` | `useBusinessBillingStatus`, `useOwnerRole` |
| `BillingLockedButton.tsx` | `useRequireCanWriteAction` |
| `ProtectedFeature.tsx` | `useUserRole`, `supabase/types` |
| `useSubscription.tsx` | `supabase/client`, `useAuth` |
| `useBusinessBillingStatus.tsx` | `supabase/client`, `useBusinessAccess`, `useUserRole` |
| `useRequireCanWriteAction.tsx` | `useBusinessBillingStatus`, `useBusinessAccess` |
| `useOwnerRole.tsx` | `supabase/client` |
| `Subscribe.tsx` | `MainLayout`, `useSubscription`, `useAuth`, `useActiveBusiness`, `formatCurrency` |
| `Subscriptions.tsx` | `MainLayout`, `SubscriptionPlans`, `useUserRole` |
| `SubscriptionPlans.tsx` | `supabase/client`, `useUserRole` |
| Edge `grow-*` | `_shared/billing.ts` |
