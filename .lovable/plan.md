

# Supplier Pairs for Smart Procurement

## Overview
Add the ability to define a pair of suppliers (A + B) per category or product. The backfill Edge Function will attach these pairs to new procurement requests. The UI will show the pair, allow setting/editing it, and support "approve" action.

---

## Part 1 -- Database Migration

### 1.1 New table: `procurement_supplier_pairs`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| business_id | uuid NOT NULL | FK to businesses, cascade delete |
| scope | text NOT NULL | CHECK in ('category','product') |
| category_id | uuid NULL | FK to categories, cascade delete |
| product_id | uuid NULL | FK to products, cascade delete |
| supplier_a_id | uuid NOT NULL | FK to suppliers, restrict delete |
| supplier_b_id | uuid NOT NULL | FK to suppliers, restrict delete |
| strategy | text NOT NULL | default 'balanced', CHECK in ('cheapest','quality','balanced') |
| is_active | boolean NOT NULL | default true |
| created_at | timestamptz NOT NULL | default now() |
| updated_at | timestamptz NOT NULL | default now() |

Constraints:
- CHECK: scope='category' implies category_id IS NOT NULL AND product_id IS NULL
- CHECK: scope='product' implies product_id IS NOT NULL
- CHECK: supplier_a_id != supplier_b_id
- Unique partial index on (business_id, product_id) WHERE scope='product' AND is_active=true
- Unique partial index on (business_id, category_id) WHERE scope='category' AND is_active=true
- Standard indexes on (business_id, scope, is_active)

RLS policies: SELECT/INSERT/UPDATE/DELETE for business owner (via businesses.owner_id = auth.uid()) and approved business_users.

### 1.2 Extend `procurement_requests`

Add columns:
- `supplier_a_id` uuid NULL references suppliers(id)
- `supplier_b_id` uuid NULL references suppliers(id)
- `pair_source` text NOT NULL default 'none' CHECK in ('product','category','none')
- `approval_status` text NOT NULL default 'pending' CHECK in ('pending','approved','rejected')

Index: (business_id, approval_status, status)

---

## Part 2 -- Edge Function Update

### Update `procurement-backfill-low-stock`

Add an internal `resolveSupplierPair` step after identifying products to create:

1. Batch-fetch all active `procurement_supplier_pairs` for the business
2. For each product to create:
   - Check product-level pair first (scope='product', product_id match)
   - Fallback to category-level pair (scope='category', category_id match -- requires fetching product's category_id)
   - If neither found: pair_source='none', no supplier IDs
3. Insert rows with: supplier_a_id, supplier_b_id, pair_source, approval_status='pending'
4. Response adds: `paired` count and `unpaired` count

To get category_id, the product query will be extended to include the category field from the products table.

---

## Part 3 -- Frontend Changes

### 3.1 New hook: `useSupplierPairs`

CRUD hook for `procurement_supplier_pairs` table:
- Fetch all pairs for the business
- Create/update/delete mutations
- Filter by scope

### 3.2 Update `useProcurementRequests` hook

- Add supplier_a_id, supplier_b_id, pair_source, approval_status to the interface and select query
- Join supplier names for display (supplier_a -> suppliers.name, supplier_b -> suppliers.name)

### 3.3 Update `useProcurementActions` hook

- Add `approveRequest` mutation: sets approval_status='approved'
- Add `updateSupplierPair` mutation: updates supplier_a_id, supplier_b_id, pair_source on a request

### 3.4 Update Procurement page table columns

In the requests table (desktop and mobile cards):
- New column "Supplier Pair": shows "SupplierA + SupplierB" or "Not set" with a "Set" button
- New column "Approval": shows badge for pending/approved/rejected, with "Approve & Send" button when pending + pair exists

### 3.5 New component: `SupplierPairDialog`

Modal for setting a supplier pair on a specific request:
- Two supplier selects (from useSuppliers, filtered to not match each other)
- Strategy select (cheapest/quality/balanced)
- Checkbox: "Save as default for this category"
- On save: upsert into procurement_supplier_pairs + update the procurement_request row

### 3.6 New tab: "Procurement Settings" in the procurement page

Add a third tab "הגדרות רכש" with two sections:

**Category defaults table:**
- Lists business categories
- Each row: category name, Supplier A select, Supplier B select, Strategy select, Active toggle
- Save creates/updates procurement_supplier_pairs with scope='category'

**Product overrides table:**
- Product search (autocomplete)
- Shows existing product-level pairs
- Edit supplier A/B, strategy, active
- Badge "Override" shown when a product pair overrides a category pair

### 3.7 Update toast after scan

Show paired/unpaired counts from the Edge Function response:
`נוצרו ${data.created} בקשות (${data.paired} עם זוג ספקים, ${data.unpaired} ללא)`

---

## Files to Create/Modify

| File | Action |
|---|---|
| SQL migration | Create procurement_supplier_pairs table, alter procurement_requests |
| supabase/functions/procurement-backfill-low-stock/index.ts | Add resolveSupplierPair logic |
| src/hooks/useSupplierPairs.tsx | New CRUD hook |
| src/hooks/useProcurementRequests.tsx | Extend interface + query |
| src/hooks/useProcurementActions.tsx | Add approve + update pair mutations |
| src/components/procurement/SupplierPairDialog.tsx | New modal component |
| src/components/procurement/ProcurementSettingsTab.tsx | New settings tab |
| src/components/procurement/CategoryPairsTable.tsx | Category defaults management |
| src/components/procurement/ProductPairsTable.tsx | Product overrides management |
| src/pages/Procurement.tsx | Add settings tab, update table columns, update toast |
| src/components/procurement/ProcurementDetailDrawer.tsx | Show pair info in drawer |

