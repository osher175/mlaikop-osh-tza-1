# Import Module — Phase 1.1: Foundation Verification & Security Gate

Date: 2026-08-10
Scope: verification + minimal security fixes only. No Receiving, no inventory mutation.

---

## 1. Objects actually created (verified in database)

### Tables (all in `public`)
| Table | Tenant key | Parent FK | Notes |
|---|---|---|---|
| `import_orders` | `business_id` → `businesses(id)` ON DELETE CASCADE | — | `import_number` unique per business, `supplier_id` → `suppliers` ON DELETE SET NULL |
| `import_order_items` | `business_id` | `import_order_id` → `import_orders` CASCADE | `product_id` → `products` SET NULL, `brand_id` → `brands` SET NULL |
| `import_costs` | `business_id` | `import_order_id` CASCADE | `service_provider_supplier_id` → `suppliers` SET NULL |
| `import_payments` | `business_id` | `import_order_id` CASCADE | `import_cost_id` → `import_costs`, `payee_supplier_id` → `suppliers` |
| `import_documents` | `business_id` | `import_order_id` CASCADE | `storage_path`, `original_filename`, `uploaded_by` default `auth.uid()` |
| `import_events` | `business_id` | `import_order_id` CASCADE | append-only audit trail |
| `import_pin_settings` | PK = `business_id` | — | `pin_hash`, `failed_attempts`, `locked_until`, `last_success_at` |
| `import_pin_sessions` | `business_id` + `user_id` | — | opaque `token uuid`, `expires_at`, `last_activity_at` |

### Functions / read models
`can_manage_business_imports`, `import_orders_page`, `import_order_landed_cost`,
`import_quantity_in_transit`, `import_pin_status`, `import_pin_verify`, `import_pin_set`,
`import_pin_session_touch`, `import_pin_lock`,
triggers: `import_assign_number`, `import_enforce_order_tenant`, `import_log_event`,
`update_updated_at_column`, **new:** `import_enforce_related_tenant`.
No SQL views were created (read models are RPCs).

### Storage
Bucket `import-documents`, `public = false`. Four policies (`select/insert/update/delete`) gated on
`can_manage_business_imports(split_part(name,'/',1)::uuid)`.

### Constraint / typing verification — **PASS**
- All money fields are `numeric` (no `float`/`double precision`). `amount_ils` on costs/payments are stored generated `numeric` values.
- `ordered_quantity > 0`, `received_quantity >= 0`, `amount >= 0`, `expected_unit_cost_ils >= 0`, `planned_sale_price_ils >= 0`, `file_size >= 0`.
- Currency codes constrained to `^[A-Z]{3}$`; exchange rates constrained `> 0` when present.
- Enumerations enforced by CHECK for `status`, `purchase_type`, `cost_state`, `category`, `payment_type`, `payment_status`, `document_type`, `event_type`, `item_status`.
- Child rows cannot be orphaned (all `import_order_id` FKs are `ON DELETE CASCADE`, `NOT NULL`).
- `import_enforce_order_tenant` blocks a child row whose `business_id` differs from its parent order.

### Issue found and FIXED (P1)
`import_orders.supplier_id`, `import_order_items.product_id`,
`import_costs.service_provider_supplier_id` and `import_payments.payee_supplier_id` had **no tenant
validation** — a crafted API call could attach another tenant's supplier/product UUID.
This is inert in Phase 1 but would become a **P0 in Phase 2** (receiving would write to a foreign
tenant's product).
**Fix applied:** trigger function `import_enforce_related_tenant()` on all four tables rejects any
reference whose `business_id` does not match the row's `business_id`.

### Indexes — **PASS**
`(business_id, status)`, `(business_id, created_at DESC)`, `(business_id, estimated_arrival_date)`,
unique `(business_id, import_number)`, `supplier_id`, per-child `import_order_id`, partial index on
`product_id WHERE product_id IS NOT NULL`, events `(import_order_id, created_at DESC)`.
These match the actual `import_orders_page`, detail-tab and in-transit query patterns.

---

## 2. RLS penetration verification — **PASS (after fix)**

RLS is enabled on all 8 tables. Policies:

| Table | Policy | Roles | Predicate |
|---|---|---|---|
| orders / items / costs / payments / documents | `*_manage` (ALL) | `authenticated` | `can_manage_business_imports(business_id)` on both USING and WITH CHECK |
| `import_events` | SELECT only | `authenticated` | `can_manage_business_imports(business_id)` |
| `import_pin_settings`, `import_pin_sessions` | **none** | — | fully denied to clients; reachable only through SECURITY DEFINER RPCs |

`can_manage_business_imports(_business_id, _user_id = auth.uid())` returns true only for:
business owner, `business_users` with `status='approved'` and role in (`OWNER`,`admin`),
`user_businesses` role in (`OWNER`,`admin`), or a platform `user_roles.role = 'admin'`.

Result matrix (derived from policy predicates + grants, applies to direct PostgREST/SQL access, not just UI):

| Actor | orders | items | costs | payments | landed cost RPC | documents | events |
|---|---|---|---|---|---|---|---|
| Authorized owner / business admin | R/W | R/W | R/W | R/W | allowed | R/W + signed URL | read |
| Ordinary employee (`business_users` role user, even approved) | denied | denied | denied | denied | `42501` | denied | denied |
| Cross-tenant user (knows the UUID) | 0 rows / denied write | denied | denied | denied | `42501` | denied | denied |
| Anonymous | denied (no policy for `anon`, and grants revoked) | denied | denied | denied | denied | denied | denied |

Every import RPC re-checks `can_manage_business_imports` internally and raises `42501`, so
`SECURITY DEFINER` cannot be used as a bypass. Existence of another tenant's order is not
inferable: reads return zero rows and RPCs return a uniform `Access denied`.

**Fix applied (P2):** all import tables had leftover `anon` grants (`arwdDxtm`). RLS already denied
`anon` (no `anon` policy), but the grants were revoked for defense in depth, and
`import_pin_settings` / `import_pin_sessions` grants were revoked from `authenticated` as well.

---

## 3. PIN / Step-Up verification — **PASS**

| Requirement | Result | Evidence |
|---|---|---|
| Exactly 4 digits at UX layer | PASS | `ImportPinGate.tsx` `maxLength=4` + `/^\d{4}$/`; server re-validates `^\d{4}$` |
| Raw PIN never persisted | PASS | only `pin_hash` column exists |
| Secure hashing (not SHA/MD5) | PASS | `extensions.crypt(pin, gen_salt('bf'))` — bcrypt with per-record salt |
| Verification server-side | PASS | `import_pin_verify` (SECURITY DEFINER); client never sees the hash |
| Authorization independent of PIN | PASS | RLS/RPCs gate on `can_manage_business_imports` only; PIN state is never consulted by any policy |
| Knowing the PIN alone grants nothing | PASS | `import_pin_verify` itself raises `42501` before hash comparison if the caller is not authorized |
| 5 failed attempts → lock | PASS | `failed_attempts + 1 >= 5` sets `locked_until = now() + 15 min`; verify short-circuits while locked |
| Success resets failure state | PASS | `failed_attempts = 0, locked_until = NULL, last_success_at = now()` |
| Unlock expiry | PASS | see below |
| Refresh / direct navigation bypass | PASS | `ImportPinGate` re-validates the token against `import_pin_session_touch` on every mount; a stale/absent/foreign token renders the gate |
| PIN in localStorage/sessionStorage | PASS | only an opaque server-issued `uuid` token is stored in `sessionStorage`; the PIN never leaves the form state |
| Cross-business PIN state | PASS | token row is keyed `(business_id, user_id, token)`; `session_touch` matches all three, and the storage key is namespaced `mlaiko.import.unlock.<businessId>` |

### How the 30-minute unlock works
1. `import_pin_verify(business_id, pin)` → authorization check → bcrypt compare → deletes prior
   sessions for that user/business (and all expired rows) → inserts a new row with a random `token`
   and `expires_at = now() + 30 min` → returns the token.
2. The client keeps the token in `sessionStorage` under a per-business key (cleared when the tab
   closes). The PIN itself is discarded.
3. On mount/route change the client calls `import_pin_session_touch(business_id, token)`, which
   only succeeds if the row exists, belongs to `auth.uid()` and `expires_at > now()`; on success it
   slides `expires_at` to `now() + 30 min`. So the window is **30 minutes of inactivity**, not a
   fixed session length.
4. `import_pin_lock` deletes the session immediately; `import_pin_set` deletes **all** sessions for
   the business, forcing re-entry after a PIN change.

The PIN is a step-up UX control layered on top of RLS, exactly as specified — not an authorization
grant.

---

## 4. Inventory isolation — **PASS**

Static search across `src/pages/ImportCenter.tsx`, `src/pages/ImportOrderDetail.tsx`,
`src/components/import/*`, `src/hooks/useImportOrder*.tsx`, `src/hooks/useImportPin.tsx`,
and all import database objects:

- no call to `execute_inventory_transaction`
- no write to `products` (no `products.quantity`, no `products.cost` update)
- no insert into `inventory_actions`
- no stock movement created anywhere
- ordered quantity is never surfaced as available stock (`ordered_quantity` / `received_quantity`
  are read-only columns on `import_order_items`)
- no trigger on import tables touches `products` or `inventory_actions` (verified trigger list:
  only numbering, tenant enforcement, event logging, `updated_at`)

Phase 1 is **read/planning only** with respect to physical inventory.

---

## 5. Quantity in transit — **PASS (derived, not yet surfaced in UI)**

`import_quantity_in_transit(p_business_id, p_product_ids uuid[])`:

- fully derived at query time — no column on `products`, nothing stored/mutable
- aggregates across all active orders for the product: `SUM(GREATEST(ordered - received, 0))` grouped by `product_id`
- excludes items with `item_status IN ('received','cancelled')` and orders whose status is
  `completed` / `cancelled`, so finished imports drop out automatically
- received quantities are already deducted per item, so Phase 2 receiving needs no extra wiring
- server-side aggregation, tenant-guarded, hard-capped at 100 product ids per call (raises above that)
- no N+1: one call per inventory page; no full catalog fetch

**Current state:** implemented and secured, **not yet consumed by the Inventory UI** (accepted for Phase 1).

---

## 6. Import Center pagination — **PASS**

- `import_orders_page` RPC: `p_limit` clamped to `LEAST(GREATEST(limit,1),100)`, default 50;
  offset clamped `>= 0`; `total_count` returned via a windowed `counted` CTE.
- Client `IMPORT_PAGE_SIZE = 50`; scope (`active`/`completed`/`all`), status filter and free-text
  search (import number / supplier name / supplier reference) all execute **server-side**.
- No `.select('*')` over `import_orders` anywhere in the client — the list view uses only the RPC;
  detail-tab queries are `.eq('import_order_id', id)` with `.limit(100–200)`.
- Aggregations (units, goods cost, import costs, paid, remaining) are computed in lateral joins over
  the paged subset only, so page cost does not grow with total order count.

---

## 7. Landed Cost verification — **PASS**

Deterministic test executed against the database using the specified numbers
(A: 100 units @ ₪100, B: 300 units @ ₪150, extra costs ₪8,000, 400 units):

| Metric | Expected | Actual |
|---|---|---|
| Overhead per unit | ₪20 | **20.0000** |
| A landed cost | ₪120 | **120.0000** |
| B landed cost | ₪170 | **170.0000** |
| A margin at planned sale ₪200 | 40% | **40.00** |

Additional checks:
- **Zero units:** `v_units = 0` → `overhead_per_unit = NULL`, landed/profit/margin return `NULL`. No divide-by-zero.
- **Zero planned sale price:** margin returns `NULL` (explicit guard), profit still computed.
- **Missing FX rate:** `COALESCE(working_exchange_rate_to_ils, 1)` — explicit, documented fallback (see §8 P2).
- **Rounding:** deterministic `round(..., 4)` for money, `round(..., 2)` for margin percent; all `numeric` semantics throughout.
- Cancelled items are excluded from the unit base but still listed.
- Nothing is written to `products.cost`.

**Finding (P1) — RESOLVED in Phase 1.2:** the overhead pool summed **all** rows in `import_costs`
regardless of `cost_state`, so an `estimated` row and its later `final` row were added together and
inflated the landed cost. Resolved by the single-row estimate/final model and the
`effective_amount_ils` rule — see `docs/IMPORT_MODULE_PHASE_1_2_LANDED_COST_POLICY.md`.

---

## 8. FX behavior — **PASS**

- Order-level `working_exchange_rate_to_ils` is the working rate; per-row `exchange_rate_to_ils`
  exists on both `import_costs` and `import_payments`.
- `amount_ils` on costs and payments is a **stored generated column**
  (`round(amount * COALESCE(exchange_rate_to_ils, 1), 2)`) — it is frozen at write time and is
  **not** recalculated if the order's working rate later changes. Historical values stay auditable.
- Both the foreign `amount` + `currency_code` and the ILS value are retained on every row.
- Currency codes validated by CHECK `^[A-Z]{3}$`; rates must be `> 0` when present.
- No external FX service or network call was introduced.

**P2:** a missing rate silently defaults to `1.0`. It is explicit in SQL but not surfaced in the UI;
a warning badge on rows with `exchange_rate_to_ils IS NULL` and a non-ILS currency is recommended.

---

## 9. Documents — **PASS**

- Bucket `import-documents` is **private** (`public = false`); no public URL is ever generated.
- Access exclusively through `createSignedUrl(path, 120)` — 2-minute signed URLs, opened with
  `noopener,noreferrer`.
- Path shape `"<business_id>/<import_order_id>/<document_id>/<filename>"`; all four storage policies
  derive the tenant from `split_part(name, '/', 1)` and require `can_manage_business_imports`.
- Path traversal: the client sanitises the filename with `replace(/[^\w.\-]/g, '_')`, and even a
  crafted path cannot help — the first segment is what the policy authorises, so escaping the
  prefix means failing the check.
- Cross-tenant fetch is blocked at the storage-policy level; ordinary employees fail
  `can_manage_business_imports` and cannot list, read or sign any import document.

---

## 10. UI access — **PASS**

- `/import` and `/import/:id` are wrapped in `ProtectedRoute allowedRoles={['admin','OWNER','smart_master_user','elite_pilot_user']}`, so direct navigation by an unauthorized user is rejected before render — sidebar hiding is not the control.
- Second layer: the PIN gate; third and authoritative layer: RLS/RPC `42501` for any actor failing `can_manage_business_imports`, so an under-privileged plan role that reaches the route still sees no data.
- RTL: all import screens set `dir="rtl"` and use Hebrew labels.
- Responsiveness, empty states, loading states (spinners/skeletons), error toasts, pagination controls and PIN states (configure / unlock / locked-out) are all implemented in `ImportCenter.tsx`, `ImportOrderDetail.tsx` and `ImportPinGate.tsx`.

---

## 11. Event history — **PASS**

`import_log_event()` writes to `import_events` with `business_id` from the row and
`actor_user_id = auth.uid()`:

| Event | Trigger |
|---|---|
| `order_created` | INSERT on `import_orders` |
| `status_changed`, `eta_changed` | UPDATE on `import_orders` |
| `cost_added`, `cost_updated` | INSERT/UPDATE on `import_costs` |
| `payment_added` | INSERT on `import_payments` |
| `document_uploaded` | INSERT on `import_documents` |

Metadata contains only domain values (status, category, amount_ils, payment type, document type,
original filename). **No PINs, no signed URLs, no storage paths, no tokens, no secrets.**
`import_events` is SELECT-only for clients (no INSERT/UPDATE/DELETE policy), so the trail is
append-only from the application's perspective.

---

## 12. Existing Mlaiko regression — **PASS**

- Phase 1.1 changes are purely additive: one new trigger function + four triggers scoped to
  `import_*` tables, plus grant revocations on `import_*` only.
- No change to Inventory, Products, Suppliers, Sales, Procurement, authentication, tenant switching,
  or the Product Scale pagination RPCs.
- Typecheck (`tsgo --noEmit`): **clean**.
- Production build: **success**, 16.4 s, initial chunk `index` 789.08 kB (232.24 kB gzip) — unchanged
  from the Phase A5.1 baseline.
- Lint/tests: no import-module test suite exists; nothing regressed in the existing setup.

---

## Remaining items

**P0:** none.

**P1**
1. ~~Landed cost mixes `estimated` and `final` cost rows (§7).~~ **Resolved in Phase 1.2** —
   see `docs/IMPORT_MODULE_PHASE_1_2_LANDED_COST_POLICY.md`.

**P2**
1. Missing FX rate silently defaults to 1.0 — surface a UI warning.
2. `quantity_in_transit` not yet displayed in the Inventory UI.
3. `import_documents` has no UPDATE/DELETE lifecycle in the UI (rows are insert-only in practice).
4. Project-wide Supabase linter warnings (extension in public, generic SECURITY DEFINER warnings)
   are pre-existing and unrelated to this module.

---

## Fixes applied in Phase 1.1

1. **Cross-tenant reference hardening (P1 → resolved):** `import_enforce_related_tenant()` trigger on
   `import_orders`, `import_order_items`, `import_costs`, `import_payments` rejects supplier/product
   references belonging to another business.
2. **Grant hygiene (P2 → resolved):** revoked all `anon` grants on the eight import tables, revoked
   `authenticated` grants on the two PIN tables, and re-stated the intended `authenticated` /
   `service_role` grants.

---

## FINAL VERDICT

**PASS — safe to start Phase 2 Receiving**

with the standing condition that the estimated-vs-final cost policy (P1 #1) is decided before
landed cost is written into `products.cost`.
