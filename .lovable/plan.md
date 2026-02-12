

# Edge Function: `n8n-select-suppliers` -- Implementation Plan

## Overview
Create a new Edge Function that serves as a secure n8n gateway for supplier selection. It follows the exact same security pattern as `n8n-outbox-pull` and `n8n-outbox-ack` (shared secret via `x-n8n-secret`), but implements the multi-source supplier selection logic currently in `procurement-select-suppliers` -- adapted for n8n consumption with richer output (name, phone, source label).

---

## Security & Pattern
- Authentication via `x-n8n-secret` header (same as existing n8n functions)
- `service_role` used internally (server-side only)
- UUID validation on `business_id` and `product_id`
- CORS headers identical to `n8n-outbox-pull`
- `verify_jwt = false` in `config.toml`

---

## Input (POST JSON)

```text
{
  "business_id": "<uuid>",
  "product_id": "<uuid>",
  "limit": 3            // optional, default 3, max 5
}
```

## Output (JSON)

```text
{
  "suppliers": [
    {
      "supplier_id": "<uuid>",
      "supplier_name": "...",
      "phone": "...",
      "source": "preferred" | "category" | "brand",
      "priority": 1
    }
  ]
}
```

Phone comes from `suppliers.phone` column (confirmed it exists in the schema).

---

## Supplier Selection Logic (priority order)

The function collects suppliers from 3 sources in order, skipping duplicates, until `limit` is reached:

1. **Preferred**: `products.preferred_supplier_id` -- if set, this is always priority 1 with source `"preferred"`.
2. **Category**: `category_supplier_preferences` rows matching `business_id` + `product_category_id`, ordered by `priority ASC`. Source: `"category"`.
3. **Brand**: `supplier_brands` rows matching `business_id` + `brand_id` + `is_active=true`, joined with `brands` for tier ordering (A, B, C), then by `priority ASC`. Source: `"brand"`.

Each supplier is enriched with `name` and `phone` from the `suppliers` table before returning. Duplicates across sources are eliminated (a supplier found in "preferred" won't appear again from "category").

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/n8n-select-suppliers/index.ts` | New Edge Function |
| `supabase/config.toml` | Add `[functions.n8n-select-suppliers]` with `verify_jwt = false` |

---

## Technical Details

The function structure:

1. CORS preflight check
2. Validate `x-n8n-secret` header (401 if invalid)
3. Parse JSON body, extract `business_id`, `product_id`, `limit`
4. UUID validation on both IDs (400 if invalid)
5. Clamp limit: default 3, max 5
6. Load product from DB (404 if not found)
7. Collect supplier IDs from 3 sources (preferred, category, brand) into an ordered array with source labels, skipping duplicates, stopping at limit
8. Batch-fetch supplier details (name, phone) from `suppliers` table for all collected IDs
9. Return formatted response

No secrets need to be added -- `N8N_SHARED_SECRET` is already configured.

