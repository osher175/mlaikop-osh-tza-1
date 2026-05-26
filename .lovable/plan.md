
# Grow Subscription Payment Integration

## Overview
Build a typed helper that produces a validated Grow payload for monthly subscription checkout, plus an Edge Function that persists status and (later) forwards to Make/n8n. The existing `payment_sessions` table already has all needed columns (`business_id`, `user_id`, `plan_id`, `payment_provider`, `provider_session_id`, `status`, `checkout_url`, `metadata`) — no schema migration needed for tracking.

## Decisions (made based on context)
- **No new tables.** Reuse `payment_sessions` for status. `payment_provider='grow'`.
- **Status vocabulary:** map to existing `status` column → `pending_payment`, `payment_link_created`, `paid`, `failed` (free-text, no enum constraint).
- **Price = monthly_price including 18% VAT** (Grow expects gross price; aligns with `mem://style/currency-standardization`).
- **No live Grow API call yet** — Edge Function builds + validates payload, persists `pending_payment`, returns payload. Forwarding to Make/n8n/Grow is a follow-up wire-up.
- **Subscription plans source:** uses existing `subscription_plans` table (referenced in `get_user_profile_for_admin`). No changes.

## Files to add

### 1. `src/lib/payments/buildGrowSubscriptionPayload.ts`
Pure helper + Zod schema:

```ts
export const GrowSubscriptionInputSchema = z.object({
  business: z.object({ id: z.string().uuid(), name: z.string().min(1) }),
  user:     z.object({ full_name: z.string().min(1), email: z.string().email(), phone: z.string().min(7) }),
  plan:     z.object({ id: z.string().min(1), name: z.string().min(1), monthly_price: z.number().positive() }),
});

export function buildGrowSubscriptionPayload(input): GrowPayload
// throws ValidationError listing missing fields (price, name, business_id, email, phone)
```

Returns the exact shape requested (paymentType, maxOrCustom, paymentsMaxNumber=1, products[1], customer{}).

### 2. `src/lib/payments/types.ts`
TypeScript types: `GrowPayload`, `GrowProduct`, `GrowCustomer`, `GrowPaymentStatus`.

### 3. `supabase/functions/grow-create-subscription/index.ts`
- `verify_jwt = true` (auth required)
- Validates input with Zod
- Loads business + plan + profile rows server-side (defense in depth, ignores client price)
- Calls `buildGrowSubscriptionPayload`
- Inserts row into `payment_sessions` with `status='pending_payment'`, `payment_provider='grow'`, `metadata={ payload, billing_cycle:'monthly' }`
- Returns `{ session_id, payload }` so the frontend/Make can forward it
- CORS handled; uses anon-key client + service-role for insert

### 4. `supabase/functions/grow-update-session-status/index.ts`
- Endpoint used by Make/n8n webhook (verify_jwt=false, header secret `x-mlaiko-secret`)
- Body: `{ session_id, status, provider_session_id?, checkout_url? }`
- Updates `payment_sessions` row; on `paid` sets `completed_at=now()`
- Inserts `billing_events` row (`event_type='grow_status_change'`)

### 5. `supabase/config.toml`
Add the two new functions (`grow-create-subscription` JWT-verified, `grow-update-session-status` JWT-skipped + uses shared secret).

## Validation rules (enforced in helper + Edge Function)
| Field | Rule | Error |
|---|---|---|
| `plan.monthly_price` | required, > 0 | `MISSING_PRICE` |
| `plan.name` | required, non-empty | `MISSING_PLAN_NAME` |
| `business.id` | required, UUID | `MISSING_BUSINESS_ID` |
| `user.email` | required, valid email | `MISSING_EMAIL` |
| `user.phone` | required, ≥7 chars | `MISSING_PHONE` |

## Status lifecycle
```
pending_payment → payment_link_created → paid
                                     ↘ failed
```
Stored in `payment_sessions.status`. Every transition logs to `billing_events`.

## Secrets needed (added later when wiring to Grow/Make)
- `GROW_WEBHOOK_SECRET` — shared secret Make/n8n sends in `x-mlaiko-secret` header to update status
- `MAKE_WEBHOOK_URL` (optional, future) — if we want the Edge Function to push the payload directly to Make

These will be requested via `add_secret` only when we wire the forwarder — not in this initial step (matches the user's "להכין את זה כך שבהמשך נוכל לשלוח" requirement).

## What this enables next
- Hook the helper into the existing `/subscribe` page subscribe button
- Add a Make scenario / n8n flow that consumes the payload and creates the Grow transaction
- The Make scenario posts back to `grow-update-session-status` with the real `checkout_url` + provider id

## Out of scope (explicit)
- Live Grow API call (no Grow credentials yet)
- Annual billing cycle (designed for, not implemented)
- Multi-product carts
- Frontend UI changes to `/subscribe`
