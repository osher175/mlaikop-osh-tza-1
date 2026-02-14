
# WhatsApp Business Platform (Meta Cloud API) + Multi-Business + Premium Gate

## Overview
This is a large-scale implementation covering 8 parts: Onboarding fix, Premium server-side gate, WhatsApp channel management, Meta Embedded Signup, message sending, webhook handling, UI integration, and security. Below is the full plan.

---

## Part 1 -- Fix Onboarding

### 1.1 Fix `handle_new_user` Trigger

**Current problem**: The trigger inserts into `user_roles` with `business_id` set (presumably to `auth.uid()` in an older version -- the current live version sets it but the column exists).

**Fix**: Update the trigger so `business_id` remains `NULL` at signup. Only `profiles` + `user_roles(role='free_user', business_id=NULL)` are created.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  IF NEW.email = 'oshritzafriri@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role, business_id)
    VALUES (NEW.id, 'admin', NULL);
    RETURN NEW;
  END IF;
  
  INSERT INTO public.user_roles (user_id, role, business_id)
  VALUES (NEW.id, 'free_user', NULL);
  
  RETURN NEW;
END;
$$;
```

### 1.2 Atomic Business Creation RPC

Create `create_business_for_new_user(p_business_name text, p_phone text) RETURNS uuid`:
- Checks if user already owns a business (idempotency)
- INSERT into `businesses` with `owner_id = auth.uid()`
- INSERT into `user_businesses` (join table)
- UPDATE `user_roles` SET `business_id` = new business ID
- Returns the `business_id`
- All within a single transaction
- SECURITY DEFINER with `search_path = 'public'`

---

## Part 2 -- Premium Server-Side Gate

### 2.1 DB Function: `require_premium`

```sql
CREATE OR REPLACE FUNCTION public.require_premium(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_status text;
  v_trial_ends_at timestamptz;
BEGIN
  SELECT owner_id INTO v_owner_id FROM businesses WHERE id = p_business_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  SELECT status, trial_ends_at INTO v_status, v_trial_ends_at
  FROM user_subscriptions
  WHERE user_id = v_owner_id
  LIMIT 1;

  IF v_status = 'active' THEN RETURN true; END IF;
  IF v_status = 'trial' AND v_trial_ends_at > now() THEN RETURN true; END IF;

  RAISE EXCEPTION 'Premium subscription required';
END;
$$;
```

### 2.2 Update Edge Functions

Add a `require_premium` check at the top of:
- **`procurement-start-outreach`**: After validating `business_id`, call `supabase.rpc('require_premium', { p_business_id: business_id })`. If error, return 403.
- **`procurement-backfill-low-stock`**: Same pattern.
- Any webhook that opens a conversation.

---

## Part 3 -- WhatsApp Business Channels Table

### New Table: `business_channels`

```sql
CREATE TABLE public.business_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  waba_id text NOT NULL,
  phone_number_id text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connected','error')),
  webhook_verify_token text DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_health_check_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_business_channels_phone_number_id 
  ON business_channels(phone_number_id);

CREATE INDEX idx_business_channels_business 
  ON business_channels(business_id);
```

**RLS Policies**:
- SELECT: User must be business owner or approved business_user
- INSERT/UPDATE: Business owner only
- No DELETE policy (admin-only via dashboard)

**No credentials stored here** -- the Meta access token lives in Edge Function secrets (`META_WHATSAPP_ACCESS_TOKEN`).

---

## Part 4 -- Embedded Signup Integration

### 4.1 Edge Function: `meta-embedded-signup-complete`

- **Method**: POST
- **Auth**: JWT (frontend call)
- **Logic**:
  1. Validate JWT, extract user
  2. Validate `business_id` ownership
  3. Call `require_premium`
  4. UPSERT into `business_channels` with status='connected'
  5. Return success

### 4.2 Edge Function: `meta-send-message`

- **Method**: POST
- **Input**: `{ business_id, to, message_text, conversation_id? }`
- **Logic**:
  1. Validate JWT
  2. Call `require_premium`
  3. Look up `phone_number_id` from `business_channels` WHERE `business_id` and `status='connected'`
  4. POST to `https://graph.facebook.com/v18.0/{phone_number_id}/messages` with Bearer token from `META_WHATSAPP_ACCESS_TOKEN` env secret
  5. Save to `procurement_messages` with `provider_message_id` from Meta response
  6. Return result

---

## Part 5 -- Inbound Webhook

### Edge Function: `meta-whatsapp-webhook`

**Two modes**:

**GET** (verification handshake):
- Verify `hub.verify_token` matches the business channel's `webhook_verify_token`
- Return `hub.challenge`

**POST** (incoming events):
1. Validate Meta signature via `X-Hub-Signature-256` header against `META_APP_SECRET` env
2. Parse payload, extract `phone_number_id` from `entry[].changes[].value.metadata.phone_number_id`
3. Look up business via `business_channels` WHERE `phone_number_id`
4. For message events: INSERT into `procurement_messages` (direction='incoming')
5. For status events: UPDATE `procurement_messages` status
6. Always return 200

**Config**: `verify_jwt = false` (external webhook)

---

## Part 6 -- UI Integration

### 6.1 New Page: `/settings/whatsapp`

- Wrapped in `SubscriptionGuard`
- Shows connection status from `business_channels`
- "Connect WhatsApp" button triggers Meta Embedded Signup flow (opens Meta popup)
- "Test Connection" button sends a test message
- Connection status indicator (disconnected/connected/error)

### 6.2 Route Registration

Add route in `App.tsx`:
```text
/settings/whatsapp -> WhatsAppSettingsPage (protected, OWNER + premium)
```

Add navigation link in Settings page tabs.

---

## Part 7 -- Security Requirements

| Requirement | Implementation |
|---|---|
| No access_token in DB | Stored as Edge Function secret `META_WHATSAPP_ACCESS_TOKEN` |
| Webhook signature validation | `X-Hub-Signature-256` verified with `META_APP_SECRET` |
| Rate limiting | Per `phone_number_id` counter in memory (basic) |
| Business ID validation | UUID regex + ownership check on every request |
| Credentials isolation | `business_channels` has no token columns; RLS prevents cross-tenant reads |

---

## Part 8 -- Deliverables Summary

### ENV Variables to Add (via Supabase Secrets)

| Secret Name | Purpose |
|---|---|
| `META_WHATSAPP_ACCESS_TOKEN` | System User token for Graph API calls |
| `META_APP_SECRET` | For webhook signature validation |

### Edge Functions Created/Updated

| Function | Action |
|---|---|
| `meta-embedded-signup-complete` | **New** -- saves channel after Embedded Signup |
| `meta-send-message` | **New** -- sends WhatsApp via Graph API |
| `meta-whatsapp-webhook` | **New** -- receives inbound messages + verification |
| `procurement-start-outreach` | **Updated** -- add `require_premium` gate |
| `procurement-backfill-low-stock` | **Updated** -- add `require_premium` gate |

### Database Migrations

| Change | Type |
|---|---|
| Fix `handle_new_user` trigger (business_id=NULL) | ALTER FUNCTION |
| Create `create_business_for_new_user` RPC | NEW FUNCTION |
| Create `require_premium` function | NEW FUNCTION |
| Create `business_channels` table + RLS | NEW TABLE |
| Add `provider_message_id` to `procurement_messages` (if missing) | ALTER TABLE |

### New UI Files

| File | Purpose |
|---|---|
| `src/pages/WhatsAppSettings.tsx` | WhatsApp connection management page |
| `src/components/whatsapp/MetaEmbeddedSignup.tsx` | Embedded Signup component |
| `src/components/whatsapp/ConnectionStatus.tsx` | Status display component |

---

## Message Flow Diagram

```text
OUTBOUND:
  User clicks "Send" in UI
    -> meta-send-message (Edge Function)
      -> require_premium check
      -> resolve phone_number_id from business_channels
      -> POST graph.facebook.com/v18.0/{phone_number_id}/messages
      -> INSERT procurement_messages (direction='outgoing', status='sent')

INBOUND:
  Meta sends POST to meta-whatsapp-webhook
    -> Validate X-Hub-Signature-256
    -> Extract phone_number_id
    -> Lookup business via business_channels
    -> INSERT procurement_messages (direction='incoming')
    -> Return 200
```

---

## Implementation Order (Priority)

1. **DB Migration**: Fix `handle_new_user`, create `create_business_for_new_user`, create `require_premium`, create `business_channels` table
2. **Update existing Edge Functions**: Add premium gate to `procurement-start-outreach` and `procurement-backfill-low-stock`
3. **Request secrets**: `META_WHATSAPP_ACCESS_TOKEN` and `META_APP_SECRET`
4. **Create new Edge Functions**: `meta-embedded-signup-complete`, `meta-send-message`, `meta-whatsapp-webhook`
5. **Update `config.toml`**: Register all new functions
6. **Build UI**: WhatsApp settings page + route + navigation
7. **Test end-to-end**: Verify connection, sending, and receiving
