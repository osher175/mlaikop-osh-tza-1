# Retail IQ Export API — Implementation Plan

## 1. Goal & Architecture

Mlaiko exposes a **read-only Export API** so Retail IQ (external analytics platform) can pull real business data.

```
Retail IQ  ──HTTPS + x-mlaiko-api-key──▶  Supabase Edge Function (retail-iq-api)
                                                    │
                                                    ▼ (service_role, server-side only)
                                              Supabase Postgres
```

Rules:
- No mock data. No direct DB exposure to the outside.
- All access via Edge Function (Server Function).
- Per-business API key, hashed (SHA-256) at rest.
- Strict tenant scoping by `business_id` derived from the API key.
- Every call audited; basic in-memory rate limit.

## 2. Reuse vs. New

We already have `public-api` + `api_keys` + `api_key_usage_log`. To keep concerns separated and avoid touching the existing public API contract, we add a **dedicated** `retail-iq-api` edge function and **reuse** the existing `api_keys` / `api_key_usage_log` tables with a new `scope` column.

### New DB changes (single migration)

1. `api_keys.scope text not null default 'public'` — values: `'public'`, `'retail_iq'`.
2. `api_keys.rate_limit_per_min int not null default 60`.
3. Index `api_key_usage_log (api_key_id, created_at desc)` (if missing) for audit queries.

No new tables required — all data already exists.

## 3. Source Tables → Normalized JSON

| Endpoint        | Source tables                                                   | Notes |
|-----------------|-----------------------------------------------------------------|-------|
| `/branches`     | `businesses` (single-branch today) → array with 1 item          | Future-proof shape |
| `/products`     | `products` + `product_categories` + `brands` + `suppliers`      | Joined, flattened |
| `/inventory`    | `products.quantity` + `product_thresholds`                      | Current snapshot |
| `/customers`    | *No customers table today* → return `[]` with `supported:false` | Documented gap |
| `/employees`    | `user_businesses` + `profiles` + `user_roles`                   | Scoped to business |
| `/sales`        | `inventory_actions` where `action_type in ('remove','sale')`    | One row = one sale event |
| `/sale_items`   | Same rows, item-level shape (1:1 since Mlaiko has no cart)      | Documented |

All endpoints support `?updated_since=ISO8601`, `?page=`, `?limit=` (max 500, default 100).

## 4. Endpoint Structure

Base: `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/retail-iq-api`

```
GET /                    → API descriptor (version, endpoints)
GET /branches            → [{ id, name, phone, address, timezone, currency }]
GET /products?updated_since&page&limit
GET /inventory?updated_since&page&limit
GET /customers           → { data: [], supported: false }
GET /employees?page&limit
GET /sales?updated_since&from&to&page&limit
GET /sale_items?updated_since&from&to&page&limit
```

Headers (request):
- `x-mlaiko-api-key: rqk_…` (new prefix to distinguish from `mlk_`)

Headers (response):
- `X-Total-Count`, `X-Page`, `X-Limit`
- `Content-Type: application/json`

## 5. Security Model

- **Auth**: `x-mlaiko-api-key` header → SHA-256 → lookup in `api_keys` where `scope='retail_iq'` and not revoked/expired.
- **Storage**: only `key_hash` + `key_prefix` stored. Raw key returned **once** at creation.
- **Tenant isolation**: `business_id` comes from the key row — never from the caller.
- **Read-only**: function only does `SELECT` / RPC reads. No mutations.
- **Rate limit**: in-memory bucket per `api_key_id`, default 60 req/min (configurable per key).
- **Audit log**: every request → `api_key_usage_log` (endpoint, method, status, ip, ua, timestamp).
- **CORS**: only `GET` + `OPTIONS`.
- **JWT**: function deployed with `verify_jwt = false` (API-key auth in code).
- **Service role**: used server-side only, never returned.
- **Key management**: existing `api-keys-manage` function extended with `scope` param (so owners/admins can mint Retail IQ keys from the UI).

## 6. Sample JSON Responses

**`GET /products?page=1&limit=2`**
```json
{
  "data": [
    {
      "id": "0c…-uuid",
      "sku": "1001",
      "barcode": "7290011580018",
      "name": "Coca Cola 1.5L",
      "category": { "id": "…", "name": "Beverages" },
      "brand": { "id": "…", "name": "Coca Cola" },
      "supplier": { "id": "…", "name": "Central Bottling" },
      "cost_ils": 4.20,
      "price_ils": 9.90,
      "currency": "ILS",
      "vat_percent": 18,
      "created_at": "2025-03-01T08:11:00Z",
      "updated_at": "2026-06-20T14:02:11Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 187
}
```

**`GET /sales?from=2026-06-01&page=1&limit=1`**
```json
{
  "data": [
    {
      "id": "ac…-uuid",
      "branch_id": "0ed7…-business-uuid",
      "product_id": "0c…-uuid",
      "employee_id": "f1…-user-uuid",
      "quantity": 3,
      "unit_price_ils": 9.90,
      "total_ils": 29.70,
      "cost_snapshot_ils": 4.20,
      "discount_ils": 0,
      "currency": "ILS",
      "vat_percent": 18,
      "sold_at": "2026-06-19T11:42:08Z"
    }
  ],
  "page": 1, "limit": 1, "total": 412,
  "from": "2026-06-01T00:00:00Z",
  "to":   "2026-06-22T00:00:00Z"
}
```

**Error shape (uniform)**
```json
{ "error": "Invalid API key", "code": "unauthorized" }
```

## 7. Files Touched

- **Migration** (new): add `scope`, `rate_limit_per_min` to `api_keys`; add usage-log index.
- **`supabase/functions/retail-iq-api/index.ts`** (new): the whole API.
- **`supabase/config.toml`**: register `[functions.retail-iq-api] verify_jwt = false`.
- **`supabase/functions/api-keys-manage/index.ts`**: accept optional `scope` on `create` (default `'public'`) and surface it in `list`. No UI work in this plan.

## 8. QA Plan (after implementation)

1. Missing `x-mlaiko-api-key` → 401.
2. Wrong key → 401.
3. Revoked key → 401.
4. Public-scope key on `/retail-iq-api/*` → 401 (`scope mismatch`).
5. Valid Retail IQ key → 200 on each of the 7 endpoints.
6. `updated_since` filter returns only newer rows.
7. Pagination: `total`, `page`, `limit` correct; `limit>500` clamped.
8. Cross-business isolation: key for biz A cannot see biz B rows.
9. Every call appears in `api_key_usage_log`.
10. 61st call within 60s → 429.

## 9. Out of Scope (explicit)

- No UI changes (key minting UI stays as-is; only backend accepts `scope`).
- No new tables for customers/branches — gaps documented in responses.
- No write endpoints. No webhooks. No realtime push.
- No billing/subscription/auth-guard files touched (code freeze respected).
