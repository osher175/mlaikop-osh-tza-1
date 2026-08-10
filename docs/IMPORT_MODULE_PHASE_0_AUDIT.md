# Import Module — Phase 0: Architecture & Integration Audit

Status: **read-only audit**. No code, schema, RLS, UI, or migration was changed.
Date: 2026-08-10 · Scope: readiness of Mlaiko for an additive Import Management module.

---

## 1. Current architecture findings

### A. Products
| Aspect | Finding |
|---|---|
| Stock source of truth | `products.quantity` (`integer`, NOT NULL). Single scalar column — no lot/batch layer. |
| Cost | `products.cost numeric(10,2)` — rolling average, maintained **only** inside `execute_inventory_transaction`. |
| Sale price | `products.price numeric(10,2)`. No price-history table. |
| Brand | `products.brand_id → brands.id`. `brands` is **global** (no `business_id`) with `tier text`. |
| Manufacturer | **Does not exist.** Today brand ≈ manufacturer implicitly. |
| Supplier | `products.supplier_id` *and* `products.preferred_supplier_id` (both → `suppliers`). |
| Identity | `barcode text` (nullable, no SKU column, no unique constraint observed). |
| In transit | **No field, no table.** Nothing today represents ordered-but-not-received quantity. |

Implication: `quantity_in_transit` must be **derived**, never stored on `products` as a mutable
counter maintained by app code (drift risk against the paginated inventory RPCs).

### B. Inventory
- Ledger: `inventory_actions` (append-only; RLS allows only SELECT/INSERT for members — no UPDATE/DELETE).
  Reversals are modeled as new rows (`is_reversal`, `reverses_action_id`, `reversed_at/by`).
- Atomic mutation exists: `public.execute_inventory_transaction(...)` — `SECURITY DEFINER`, `plpgsql`,
  `SELECT ... FOR UPDATE` on the product row, negative-stock guard, rolling-average cost recompute,
  ledger insert then quantity update. **This is the canonical write path and Receiving must reuse it.**
- Constraint discovered: it accepts only `action_type IN ('add','remove')`, and `add` **requires**
  `p_purchase_unit_ils`. It has **no idempotency key** and **no membership check inside the function**
  (it trusts the caller-supplied `p_business_id`).
- Reversal path: `reverse_inventory_action`.
- Reads at scale: `inventory_products_page`, `inventory_stock_counts`, `products_needing_notifications`
  (Phase A5.1) — server-side pagination, search, filtering, and counters.

### C. Suppliers
`suppliers(id, name, contact_email, phone, business_id, agent_name, sales_agent_name, sales_agent_phone)`.
Tenant-scoped, RLS restricted to owner/admin (`suppliers_*_owner_admin`) — good fit for confidential import data.
Missing for import: `type` (manufacturer / dealer / broker / forwarder), `country`, `default_currency`,
`tax/VAT id`, `incoterms`, address, `is_international`. No brand↔supplier coupling on the table itself;
coupling lives in `supplier_brands` (business-scoped, priority, is_active) — that separation is already correct.

### D. Authentication & permissions
- Roles: `user_role` enum (`admin`, `free_user`, `pro_starter_user`, `smart_master_user`, `elite_pilot_user`, `OWNER`)
  in `user_roles`; membership in `business_users` / `user_businesses`; helpers `is_business_member`,
  `user_has_business_access`, `can_view_business_financials` (owner **or** admin only), `can_business_write`,
  `has_role_or_higher`, `require_active_business`, `require_premium`.
- `can_view_business_financials` is the natural gate for all import money data.
- Frontend already has a cost "privacy mode" (`useCostVisibility`) — **UI-only masking**, not a security boundary.
- **No step-up / PIN infrastructure exists** (no PIN column, no re-auth token, no elevated-session concept).

### E. Storage
Buckets: `products` (**public**), `supplier-invoices` (private). Precedent for private, tenant-scoped
document storage already exists via `supplier_invoices.file_url` + private bucket.

### F. Currency
- All money columns are `numeric` (`products.cost/price` = `numeric(10,2)`; `inventory_actions.*_ils` = unconstrained `numeric`).
  **No `float`/`double precision` found in monetary columns** — good.
- System is ILS-only by policy (`formatCurrency`, `currency text` defaulting to `'ILS'`).
- **No FX table, no exchange-rate storage, no multi-currency conversion anywhere.**

### G. Existing procurement domain
`procurement_requests`, `supplier_quotes`, `procurement_conversations/messages`, `procurement_settings`,
`supplier_preferences`, `category_supplier_preferences`, `procurement_supplier_pairs`, `automation_outbox`.
This is a **replenishment/RFQ automation domain** (low-stock trigger → WhatsApp outreach → quote scoring),
driven by n8n via the outbox. It has no concept of shipments, landed cost, customs, payments, or receiving.

### H. Performance baseline
Post Phase A3–A5.1: no full-catalog fetches on the inventory page, server-side pagination (50/page),
DB-side counters, bounded notification candidates, analytics fully aggregated in Postgres.

---

## 2. Reuse vs. new domain decisions

| Concern | Decision |
|---|---|
| Stock mutation | **Reuse** `execute_inventory_transaction` (extended additively, see §6). Never write `products.quantity` directly. |
| Ledger | **Reuse** `inventory_actions` as the movement record; add a nullable import reference column. |
| Suppliers | **Reuse** `suppliers`; extend additively with import fields. Do not fork a second supplier table. |
| Brands | **Reuse** `brands` + `supplier_brands`. Add `manufacturer` as a separate concept, not as brand. |
| Products | **Reuse**. No new stock column. `quantity_in_transit` derived. |
| Documents | **Reuse** the private-bucket pattern (new `import-documents` bucket), not the public `products` bucket. |
| Procurement tables | **Do NOT reuse.** Import Orders must be a **separate domain**. |
| `automation_outbox` | Do not extend with import events in V1 (n8n consumers assume procurement payload shape). |

**Rationale for a separate domain:** `procurement_requests` is single-product, quantity-only,
automation-owned, and has an approval/status lifecycle tuned to WhatsApp RFQ. Import orders are
multi-line, multi-brand, multi-currency, cost-bearing, document-bearing, and have a
receiving + cost-closing lifecycle. Merging them would break both lifecycles and leak import
financials into procurement RLS (which is broader than owner/admin).

---

## 3. Recommended data model (high level, no migrations)

New tenant-scoped domain, every table carrying `business_id`:

- `import_orders` — internal order no., `supplier_id`, `purchase_type` (direct / parallel-via-dealer),
  `country`, `currency`, order date, ETA, `status`, notes, `closed_at`, `closed_by`.
- `import_order_items` — `import_order_id`, `product_id` (nullable for new products) + `new_product_draft`
  fields, `brand_id`, `manufacturer` (text or `manufacturers` ref), `quantity_ordered`,
  `supplier_unit_price` (order currency), `planned_sale_price_ils`, `expected_cost_ils`,
  `quantity_received`, `landed_cost_per_unit_ils`.
- `import_costs` — cost `category` (freight, insurance, customs, duties/taxes, brokerage, port,
  storage, local transport, compliance, fx/bank fees, other), amount, currency, `fx_rate`,
  `amount_ils`, `is_final` (estimated vs. final), document ref.
- `import_payments` — `payment_type` (advance / balance / partial), paid amount, currency,
  actual `fx_rate`, `amount_ils`, payment date. Cost and payment stay **separate concepts**.
- `import_receipts` + `import_receipt_lines` — a receiving session (draft → confirmed), per-line
  received quantity, `confirmed_at`, `confirmed_by`, optional `corrects_receipt_id`.
- `import_documents` — type (commercial invoice, packing list, B/L, shipping invoice, customs,
  broker, local transport, other), storage path in a private bucket.
- `import_events` — append-only audit (created, status change, payment, ETA change, cost added,
  receiving started, receiving confirmed, correction, closed, reopened).
- Optional: `fx_rates` (currency, date, rate) and `manufacturers`.

Money columns: `numeric(14,4)` for amounts and `numeric(18,8)` for FX rates; **never float**.
Persist both the original-currency amount **and** the ILS amount with the FX rate used
(historical values must not shift when rates change).

**Landed cost V1:** `landed_cost_per_unit = purchase_cost_ils_per_unit + (Σ import_costs_ils / Σ units)`,
units = ordered before receiving, received after receiving. Compute in a Postgres function/view,
not in the browser.

**`quantity_in_transit`:** derived as
`Σ (quantity_ordered − COALESCE(quantity_received,0))` over items of orders in active (not closed/cancelled) status,
grouped by `product_id`. Expose it via a **separate, opt-in RPC** taking the current page's product ids
(≤ page size), or as a `LEFT JOIN LATERAL` inside `inventory_products_page` against an indexed
partial index on `(business_id, product_id) WHERE status IN (active…)`. Never a per-row subquery
across the catalog, never a client-side join over all orders.

---

## 4. Recommended receiving transaction flow

1. **Start receiving** → create `import_receipts` row, status `draft`. No inventory effect.
2. **Enter quantities** → upsert `import_receipt_lines`. Save/resume freely. Still no inventory effect.
3. **Confirm receiving** → one server-side RPC `import_confirm_receipt(p_receipt_id, p_business_id)`:
   - `SECURITY DEFINER`, `SET search_path = public`, **membership + owner/admin check inside**;
   - `SELECT ... FOR UPDATE` on the receipt row and `IF status <> 'draft' THEN RAISE` → prevents double receiving;
   - for each line, call the existing `execute_inventory_transaction(..., 'add', qty, purchase_unit_ils := landed-or-purchase unit)`
     so quantity, rolling-average cost, and the ledger all move through the one canonical path;
   - write `import_events`; set receipt `confirmed_at/by`; recompute `quantity_received` on items.
   - Whole thing in one transaction → all-or-nothing.
4. **Shortages / overages / partial** are natural: received ≠ ordered simply leaves residual in transit
   (or negative residual, clamped to 0 for the in-transit aggregate).
5. **Corrections** never delete: a new correction receipt with a delta, linked via `corrects_receipt_id`,
   applied through the same RPC (positive or negative delta, reusing `add`/`remove`).
6. **Post-receiving state** `received_pending_costs`: goods are live in stock, `import_costs` still editable,
   landed cost recomputed on each change.
7. **Close** freezes costs (`is_final`), writes final landed cost snapshot, logs the event.
   Reopen — if ever allowed — must be owner-only and audit-logged.

Idempotency: the receipt-status guard is the primary defense; additionally recommend a unique
constraint on `(import_receipt_line_id)` in a link column on `inventory_actions` so a replay cannot
double-post.

---

## 5. Recommended PIN / step-up architecture

The PIN is **UX friction, not authorization**. Required layering:

1. **Backend authority first** — every import table's RLS: `SELECT/INSERT/UPDATE` only where
   `business_id = <member business>` **and** `public.can_view_business_financials(business_id)`
   (owner or platform admin). Regular members get **no policy at all** on import tables →
   direct PostgREST/Supabase access returns nothing regardless of PIN.
2. **PIN storage** — never plaintext, never client-side, never `localStorage`. Store a
   salted hash (`pgcrypto` / bcrypt) in a `business_import_pins` table (or per-user), with
   `failed_attempts`, `locked_until`.
3. **Verification** — a `SECURITY DEFINER` RPC `import_verify_pin(pin)` that compares the hash,
   rate-limits (reuse the existing `check_rate_limit` pattern), logs to `audit_logs`, and returns a
   short-lived elevation record (e.g. `import_sessions` row with `expires_at`, 15–30 min).
4. **Client** — the elevated flag lives in React state/`sessionStorage` only as a UI gate; it grants nothing.
5. **Public API** — `public-api` and `retail-iq-api` scopes must **explicitly exclude** all import
   entities; api-key scopes should be allow-listed, not deny-listed.

---

## 6. Risk register

### Security / RLS
- **P0 — `brands` is global and world-writable.** Policies are `TO public` for INSERT/UPDATE/DELETE with no
  tenant scope, and the table has no `business_id`. Import will make brands business-meaningful (multi-brand
  per order); as-is, any authenticated user can rename/delete another tenant's brands. Must be resolved before
  brand-driven import reporting.
- **P0 — `execute_inventory_transaction` trusts `p_business_id`.** It is `SECURITY DEFINER` with no internal
  membership check, so it bypasses `products`/`inventory_actions` RLS. Today it is only reachable with a
  caller-supplied business id; the import receiving RPC must **not** widen this. Add an internal
  `is_business_member(auth.uid(), p_business_id)` guard (or wrap it) as part of Phase 1.
- **P1 — cost privacy is UI-only.** `useCostVisibility` masks; it does not prevent a regular member from
  reading `products.cost` via PostgREST (`products_select_member` is member-wide). Import money data must
  therefore live in separate tables, never as new columns on `products`.
- **P1 — `products` storage bucket is public.** Import documents must go to a new **private** bucket with
  `storage.objects` policies keyed on a `business_id/` path prefix + `can_view_business_financials`.
- **P2 — API surface.** Verify the export APIs' scope allow-list before the module ships.

### Inventory integrity
- **P0 — double receiving** is the main hazard: guard with row lock + status check + a unique link between
  receipt line and inventory action.
- **P1 — bypassing the canonical path.** Any direct `UPDATE products SET quantity` in import code would break
  rolling-average cost and the ledger. Forbidden.
- **P1 — `add` requires `purchase_unit_ils`**, and rolling-average cost will be computed from whatever unit
  cost receiving passes. Decide explicitly: post at **purchase cost** at receiving and (optionally) post a
  cost-only adjustment at close when landed cost is final. Posting a provisional landed cost that later
  changes will leave `products.cost` stale.
- **P2 — negative-stock guard** will reject correction deltas larger than current stock; corrections UI must
  surface that error rather than silently failing.

### Currency / data types
- **P1 — no FX infrastructure.** Every foreign-currency amount must be stored together with the rate and the
  derived ILS amount at transaction time.
- **P2 — `numeric(10,2)` ceiling** on `products.cost/price` caps values at 99,999,999.99 and truncates
  landed-cost cents-fractions; import math should be done at higher scale and rounded once at the boundary.
- **P2 — rounding of the per-unit overhead allocation** will not sum exactly to the total; define a
  remainder-absorption rule (largest-line rounding) up front.

### Performance
- **P1 — `quantity_in_transit` on the inventory page.** Must be computed for the ≤50 visible products only,
  or via a lateral join on an indexed aggregate. A naive `products LEFT JOIN import_order_items` aggregate
  across the catalog reintroduces exactly the full-scan pattern Phase A5.1 removed.
- **P2 — N+1 in the import order detail** (items → product → brand → supplier): resolve with one RPC
  returning a `jsonb` document per order.
- **P2 — landed cost recomputation** should be an on-read function/materialized snapshot per order, not a
  per-item recalculation loop from the client.
- Design above is sized for 10k–50k products: all import queries are scoped by `import_order_id` or by an
  explicit product-id array bounded by the page size.

---

## 7. Recommendation

**CONDITIONAL GO.**

The foundation is right for an additive module: an append-only ledger, one atomic stock RPC with row locking,
tenant-scoped suppliers with owner/admin RLS, a private-bucket precedent, numeric (not float) money columns,
and a scale-safe paginated inventory surface. Import can be built as a clean, separate domain with **zero**
changes to existing inventory logic.

Conditions to clear before Phase 1 implementation:
1. Resolve **P0 `brands` tenancy/RLS** (or explicitly scope import brands elsewhere).
2. Agree that `execute_inventory_transaction` gets an internal membership guard, and that receiving calls it
   rather than touching `products` directly.
3. Decide the **cost-posting policy** at receiving vs. at close (purchase cost now, landed cost at close).
4. Confirm import RLS = `can_view_business_financials` only, with the PIN as step-up UX on top.
5. Confirm `quantity_in_transit` is derived and page-bounded, never a stored counter on `products`.

No P0 blocks the *design*; the two P0s block *safe implementation* and are both narrow, contained fixes.
