# Code Freeze: Subscription Lock & Grow Payment Flow

## Goal
Lock down the subscription/payment/lock system exactly as-is. No refactors, renames, schema changes, or behavioral tweaks unless explicitly approved. Other Mlaiko development continues but must not touch this surface.

## Step 1 — Create `CODE_FREEZE_SUBSCRIPTION.md` at repo root

A single source-of-truth document listing every file/component/function/table that is frozen, plus the rules. Contents outline:

- **Why this freeze exists** — the payment and lock flow is stable and revenue-critical; changes risk breaking billing.
- **Rules** (copied from the user's directive):
  - No refactor/redesign/rename/optimization on listed items.
  - No DB schema changes to subscription / payment_sessions / plans / trials / user_subscriptions.
  - No RLS policy changes on those tables unless explicitly requested.
  - No changes to checkout URLs, webhook payloads, or payment status transitions.
  - Allowed: critical bug fixes (if explicitly requested), security fixes that don't change behavior.
- **Frozen surface** (identified from codebase scan):

  **Frontend — guards, hooks, UI**
  - `src/components/subscription/SubscriptionGuard.tsx`
  - `src/components/billing/BillingReadOnlyBanner.tsx`
  - `src/components/billing/BillingLockedButton.tsx`
  - `src/components/ProtectedFeature.tsx` (subscription-related portions)
  - `src/hooks/useSubscription.tsx`
  - `src/hooks/useBusinessBillingStatus.tsx`
  - `src/hooks/useRequireCanWriteAction.tsx`
  - `src/hooks/useOwnerRole.tsx` (only the parts feeding billing decisions)

  **Frontend — pages / routing**
  - `src/pages/Subscribe.tsx`
  - `src/pages/Subscriptions.tsx` (and `mlaikop-osh-tza-1-main/src/pages/Subscriptions.tsx`)
  - `src/components/SubscriptionPlans.tsx`
  - Any `/subscribe`, `/subscriptions`, `?expired=true` redirects in router setup

  **Payment payload builder**
  - `src/lib/payments/buildGrowSubscriptionPayload.ts`
  - `src/lib/payments/types.ts`

  **Edge functions (Grow / Make / webhooks)**
  - `supabase/functions/grow-create-subscription/index.ts`
  - `supabase/functions/grow-start-checkout/index.ts`
  - `supabase/functions/grow-update-session-status/index.ts`
  - `supabase/functions/_shared/billing.ts`

  **Database (frozen — no migrations without approval)**
  - Tables: `subscription_plans`, `user_subscriptions`, `payment_sessions`, `billing_events`
  - Functions: `business_billing_status`, `activate_subscription_on_paid` (trigger + fn), trial creation RPC, `require_premium`
  - RLS policies on the above tables

  **Admin bypass**
  - Admin bypass logic inside `useBusinessBillingStatus` and `SubscriptionGuard` (userRole === 'admin' branches)

- **Change procedure**: any PR touching a listed item must be explicitly approved by the project owner and reference this document.

## Step 2 — Add freeze comment header to each frozen source file

Insert this exact comment at the top of each frozen file (under any `"use client"` / imports as appropriate, language-adjusted `//` or `--`):

```
// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
```

Applied to the files listed under "Frontend" and "Edge functions" above. No logic changes — comment only.

## Out of scope
- No code behavior changes.
- No DB migrations.
- No edits to files outside the frozen list.

## Technical notes
- Comments are non-functional; build/tests unaffected.
- `mlaikop-osh-tza-1-main/` mirror copies receive the same header where a frozen file exists there.
- If during the scan I discover an additional file clearly part of this flow (e.g. a small helper), I'll add it to the doc and tag it too — no other changes.
