# Mlaiko — Smart Procurement Webhook Documentation

> Internal reference for n8n/Make integration. All endpoints require the `x-mlaiko-secret` header.

---

## Authentication

All endpoints validate a shared secret:

| Header | Value |
|---|---|
| `x-mlaiko-secret` | Value of `MLAIKO_WEBHOOK_SECRET` env var |
| `Content-Type` | `application/json` |

Missing/mismatched secret → `401 Unauthorized`.

---

## Endpoints

### 1. `procurement-quote-webhook` — Receive supplier quote

**URL:** `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-quote-webhook`  
**Method:** `POST`

#### Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `procurement_request_id` | UUID | ✅ | Must exist in DB |
| `business_id` | UUID | ✅ | Must match the request's business |
| `supplier_id` | UUID | ✅ | |
| `price_per_unit` | number | ✅ | Must be > 0 |
| `available` | boolean | ❌ | Default: `true` |
| `delivery_time_days` | int \| null | ❌ | Null treated as 30 days for ranking |
| `currency` | string | ❌ | Default: `"ILS"` |
| `raw_message` | string | ❌ | Free text from supplier |
| `quote_source` | string | ❌ | One of: `whatsapp`, `email`, `manual`, `api`. Default: `"api"` |

#### Example Payload

```json
{
  "procurement_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "business_id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "supplier_id": "c1d2e3f4-a5b6-7890-cdef-ab1234567890",
  "price_per_unit": 45.50,
  "available": true,
  "delivery_time_days": 3,
  "currency": "ILS",
  "raw_message": "מחיר מיוחד השבוע",
  "quote_source": "whatsapp"
}
```

#### Success Response (200)

```json
{
  "ok": true,
  "quote_id": "uuid",
  "procurement_request_id": "uuid",
  "status": "quotes_received|waiting_for_approval"
}
```

#### Behavior

1. Inserts quote into `supplier_quotes`
2. If status was `waiting_for_quotes` → updates to `quotes_received`
3. Runs deterministic ranking (price, delivery, supplier priority)
4. If available quotes exist → sets `recommended_quote_id` and status `waiting_for_approval`
5. If ALL quotes are `available=false` → stays at `quotes_received`
6. Sends notifications to all business admins/owners

---

### 2. `procurement-request-webhook` — Log request sent to suppliers

**URL:** `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-request-webhook`  
**Method:** `POST`

#### Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `procurement_request_id` | UUID | ✅ | Must exist |
| `business_id` | UUID | ✅ | Must match |
| `message` | string | ❌ | Optional description |

#### Example Payload

```json
{
  "procurement_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "business_id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "message": "נשלחה בקשה ל-3 ספקים"
}
```

#### Success Response (200)

```json
{
  "ok": true,
  "procurement_request_id": "uuid",
  "logged": true
}
```

---

### 3. `procurement-order-confirmed-webhook` — Supplier confirms order

**URL:** `https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-order-confirmed-webhook`  
**Method:** `POST`

#### Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `procurement_request_id` | UUID | ✅ | Must exist |
| `business_id` | UUID | ✅ | Must match |
| `supplier_id` | UUID | ✅ | |
| `status` | string | ❌ | `"ordered"` or `"confirmed"`. Default: `"ordered"` |
| `supplier_confirmation` | string | ❌ | Confirmation text to append to notes |

#### Example Payload

```json
{
  "procurement_request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "business_id": "b1c2d3e4-f5a6-7890-bcde-fa1234567890",
  "supplier_id": "c1d2e3f4-a5b6-7890-cdef-ab1234567890",
  "status": "ordered",
  "supplier_confirmation": "אישור הזמנה #12345 - משלוח ביום ראשון"
}
```

#### Success Response (200)

```json
{
  "ok": true,
  "procurement_request_id": "uuid",
  "status": "ordered"
}
```

#### Behavior

1. Updates `procurement_requests.status` to `ordered` or `confirmed`
2. **Appends** confirmation text to `notes` (does not overwrite)
3. Sends notifications to all business admins/owners

---

## Error Codes (All Endpoints)

| Code | Meaning |
|---|---|
| `400` | Invalid JSON body or missing/invalid fields |
| `401` | Missing or incorrect `x-mlaiko-secret` |
| `403` | `business_id` doesn't match the procurement request |
| `404` | Procurement request not found |
| `405` | Method not allowed (only POST accepted) |
| `409` | Procurement request is cancelled |
| `500` | Internal server error |

All errors return: `{"ok": false, "error": "message"}`

---

## Environment Variables

| Variable | Description |
|---|---|
| `MLAIKO_WEBHOOK_SECRET` | Shared secret for webhook auth |
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase |

---

## curl Examples

### Post a quote

```bash
curl -X POST https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-quote-webhook \
  -H "Content-Type: application/json" \
  -H "x-mlaiko-secret: <YOUR_SECRET>" \
  -d '{
    "procurement_request_id": "<REQUEST_UUID>",
    "business_id": "<BUSINESS_UUID>",
    "supplier_id": "<SUPPLIER_UUID>",
    "price_per_unit": 45.50,
    "available": true,
    "delivery_time_days": 3,
    "currency": "ILS",
    "quote_source": "whatsapp"
  }'
```

### Log request sent

```bash
curl -X POST https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-request-webhook \
  -H "Content-Type: application/json" \
  -H "x-mlaiko-secret: <YOUR_SECRET>" \
  -d '{
    "procurement_request_id": "<REQUEST_UUID>",
    "business_id": "<BUSINESS_UUID>",
    "message": "נשלחה בקשה ל-3 ספקים"
  }'
```

### Confirm order

```bash
curl -X POST https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/procurement-order-confirmed-webhook \
  -H "Content-Type: application/json" \
  -H "x-mlaiko-secret: <YOUR_SECRET>" \
  -d '{
    "procurement_request_id": "<REQUEST_UUID>",
    "business_id": "<BUSINESS_UUID>",
    "supplier_id": "<SUPPLIER_UUID>",
    "status": "ordered",
    "supplier_confirmation": "אישור הזמנה #12345"
  }'
```
