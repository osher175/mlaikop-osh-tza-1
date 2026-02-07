

# Smart Procurement Engine - MVP Implementation Plan

## Overview
Build a complete procurement workflow: when products go out of stock or drop below threshold, the system creates procurement requests, contacts suppliers via webhook, collects quotes, ranks them with deterministic scoring, and requires manual approval before ordering.

---

## Phase 1: Database Migration

### New Tables

**procurement_requests**
- id, business_id (FK), product_id (FK), requested_quantity, trigger_type ('out_of_stock' | 'below_threshold' | 'manual'), urgency ('low' | 'normal' | 'high'), status (full enum as specified), created_by, recommended_quote_id, notes, created_at, updated_at
- RLS: business owner or user_roles with matching business_id

**supplier_quotes**
- id, procurement_request_id (FK), supplier_id (FK), price_per_unit, available, delivery_time_days, currency (default 'ILS'), raw_message, quote_source ('whatsapp' | 'email' | 'manual' | 'api'), created_at
- RLS: through procurement_request -> business_id

**procurement_settings**
- business_id (PK/FK), approval_required (default true), max_auto_order_amount (nullable), scoring_weights (jsonb with default weights), default_urgency (default 'normal'), created_at, updated_at
- RLS: business owner

**supplier_preferences**
- id, business_id (FK), supplier_id (FK), priority_score (int, default 0), allow_auto_order (default false), created_at, updated_at
- UNIQUE(business_id, supplier_id)
- RLS: business owner

### RLS Policies
All tables will use restrictive policies checking business ownership via `businesses.owner_id = auth.uid()` or membership via `user_roles` / `business_users`, consistent with existing patterns.

### Database Function
- `score_procurement_quotes(request_id uuid)`: deterministic scoring function that normalizes price, delivery time, and supplier priority using weights from `procurement_settings`, then sets `recommended_quote_id` and updates status to `waiting_for_approval`.
- `create_procurement_request_on_stock_change()`: trigger function on `products` table that fires on UPDATE when quantity drops to 0 or below threshold, creating a `procurement_requests` row with computed `requested_quantity`.

---

## Phase 2: Edge Function - Quote Webhook Receiver

### `procurement-webhook` Edge Function
- Path: `supabase/functions/procurement-webhook/index.ts`
- `verify_jwt = false` (incoming webhooks from n8n/Make)
- Validates `x-automation-key` header for security
- Accepts POST with: `procurement_request_id`, `supplier_id`, `price_per_unit`, `available`, `delivery_time_days`, `raw_message`, `quote_source`
- Inserts into `supplier_quotes`
- If at least 1 quote exists for the request, updates status to `quotes_received`
- Runs scoring function when quotes arrive
- Logs activity to `notifications` table
- Returns success/error JSON

### Outbound Webhook Logic
- Reuse/extend the existing `clever-service` edge function pattern
- When a procurement_request is created with status `waiting_for_quotes`, the client-side hook calls an edge function that sends webhook POSTs to n8n/Make for each relevant supplier
- Payload: procurement_request_id, business_id, supplier_id, product info (name, barcode, requested_quantity)

---

## Phase 3: React Hooks

### `useProcurementRequests`
- CRUD operations for procurement_requests scoped to business
- Create manual requests from product page
- Approve/cancel actions
- Query with joined product name and quote count

### `useProcurementSettings`
- Fetch/upsert procurement_settings for the business
- Auto-create default row on first access if missing

### `useSupplierPreferences`
- Fetch/update supplier_preferences for the business
- Used in the procurement detail page for priority adjustments

### `useSupplierQuotes`
- Fetch quotes for a specific procurement_request_id
- Manual quote insertion (for quotes entered by hand)

---

## Phase 4: UI Pages and Components

### 4a. Procurement Requests List Page (`/procurement`)
- New page: `src/pages/Procurement.tsx`
- Table with columns: date, product name, requested quantity, trigger type (badge), status (color-coded badge), number of quotes, recommended supplier, actions
- Filter dropdown by status
- Hebrew RTL layout using existing MainLayout
- Mobile card view (same pattern as InventoryTable)
- Add route to App.tsx with role protection (OWNER + higher roles)
- Add sidebar menu item with ShoppingCart icon

### 4b. Procurement Request Detail Page (`/procurement/:id`)
- Header: product name, requested quantity, status badge, urgency badge
- Quotes table: supplier name, price per unit, available (checkmark), delivery days, computed score, recommended badge (star icon)
- Action buttons:
  - "Approve Order" (primary) - updates status, sends outbound webhook
  - "Select Different Quote" - dropdown/click to pick another quote
  - "Cancel Request" (destructive)
- Explanation text for recommendation
- Mobile responsive

### 4c. Product Page Enhancement
- In `InventoryTable.tsx`: add a "Request Quotes" button (ShoppingCart icon) for products that are out of stock or below threshold
- If an open procurement_request exists for the product, show a link/badge to the request instead
- Minimal change - just an additional button in the actions column

### 4d. Procurement Settings Section
- Add a tab/section in `BusinessSettings.tsx` for procurement settings
- Scoring weights sliders (price, delivery, supplier priority, reliability)
- Default urgency selector
- Toggle for approval_required

---

## Phase 5: Notifications Integration

Use the existing `notifications` table to create entries:
- When procurement_request created: "בקשת רכש חדשה נוצרה עבור {product_name}"
- When quote received: "הצעת מחיר חדשה התקבלה מ{supplier_name}"
- When recommendation ready: "המלצה מוכנה עבור {product_name}"

---

## Phase 6: Future Hook (Placeholder)

- Add a placeholder function `analyze_quotes_with_ai` in the scoring hook that currently returns null
- Comment: "// Future: call AI endpoint to improve ranking explanation"

---

## Technical Details

### Files to Create
1. `supabase/migrations/XXXXXX-procurement-tables.sql` - All 4 tables, RLS policies, triggers, scoring function
2. `supabase/functions/procurement-webhook/index.ts` - Quote receiver endpoint
3. `src/hooks/useProcurementRequests.tsx`
4. `src/hooks/useProcurementSettings.tsx`
5. `src/hooks/useSupplierPreferences.tsx`
6. `src/hooks/useSupplierQuotes.tsx`
7. `src/pages/Procurement.tsx` - List page
8. `src/pages/ProcurementDetail.tsx` - Detail page
9. `src/components/procurement/ProcurementRequestsTable.tsx`
10. `src/components/procurement/QuotesTable.tsx`
11. `src/components/procurement/ProcurementStatusBadge.tsx`
12. `src/components/procurement/ManualQuoteDialog.tsx`
13. `src/components/procurement/RequestQuotesButton.tsx` - For inventory table

### Files to Modify
1. `src/App.tsx` - Add 2 new routes
2. `src/components/layout/Sidebar.tsx` - Add procurement menu item
3. `src/components/inventory/InventoryTable.tsx` - Add "Request Quotes" button
4. `supabase/config.toml` - Add procurement-webhook function config
5. `src/pages/BusinessSettings.tsx` - Add procurement settings tab

### Security Considerations
- All RLS policies use restrictive mode matching existing patterns
- Webhook endpoint validates `x-automation-key` header (uses existing secret pattern)
- No raw SQL in edge functions
- Business isolation enforced at every level

