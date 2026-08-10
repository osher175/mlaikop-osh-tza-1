# Import Module — Phase 0.5: Security Preconditions

Scope: **only** the two P0 blockers from `docs/IMPORT_MODULE_PHASE_0_AUDIT.md`.
No import tables, no import UI, no procurement changes, no broad refactor.

---

## P0 #1 — `execute_inventory_transaction` had no internal tenant authorization

### Root cause
The function is `SECURITY DEFINER` (it must be: it writes `products` + `inventory_actions`
atomically), but it accepted `p_business_id` and `p_user_id` **as raw parameters** and never
checked them against the authenticated identity. `EXECUTE` was additionally granted to
`PUBLIC`/`anon`. Any caller with the anon key could therefore mutate stock and write ledger
rows for **any** business, and could attribute the action to **any** user id.

### Exact changes
- Added helper `public.is_active_business_actor(_business_id, _user_id)` — `SECURITY DEFINER`,
  `SET search_path = public`. It mirrors the canonical membership model already used by RLS:
  `businesses.owner_id`, `business_users` with `status = 'approved'`, `user_businesses`,
  plus the **already existing, intentionally supported** platform-admin path
  (`user_roles.role = 'admin'`).
- `execute_inventory_transaction` now, before any validation or mutation:
  - reads `auth.uid()`;
  - if `auth.uid()` is NULL → allowed **only** for trusted backend roles
    (`service_role` / `postgres` / `supabase_admin`), which may attribute the action to
    `p_user_id` (cron / edge functions); otherwise raises `42501 Not authenticated`;
  - if `auth.uid()` is present → **ignores `p_user_id`** and uses `auth.uid()` as the ledger
    actor, and requires `is_active_business_actor(p_business_id, auth.uid())`, else raises
    `42501 Not authorized for this business`.
  - Fail-closed: NULL business id or NULL actor is rejected.
- Grants: `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`.
- `search_path` remains pinned to `public`; all objects are schema-qualified.

### Preserved semantics (unchanged, verified line-by-line against the previous definition)
`SELECT ... FOR UPDATE` row lock, negative-stock guard, rolling-average cost formula,
`add`/`remove` field validation, **exactly one** `inventory_actions` insert, the subsequent
`products` update, the identical `jsonb` return shape, and the `EXCEPTION ... RAISE`
rollback behaviour. No new mutation path was introduced — Import receiving will reuse this
same function.

### Before / after authorization model
| | Before | After |
|---|---|---|
| anon (no JWT) | could execute | rejected (no grant + `42501`) |
| authenticated, other tenant | succeeded | rejected `42501` |
| owner / approved employee / `user_businesses` member | succeeded | succeeds (unchanged) |
| platform admin | succeeded | succeeds (explicitly preserved) |
| service_role backend | succeeded | succeeds, attributes to `p_user_id` |
| spoofed `p_user_id` | recorded as spoofed user | overridden with `auth.uid()` |

### Other SECURITY DEFINER inventory functions
Checked `reverse_inventory_action` — it already derives the actor from `auth.uid()` and
validates business membership, so it does **not** share this pattern. No wider
`SECURITY DEFINER` audit was performed (out of scope for this phase).

---

## P0 #2 — `brands` was world-writable

### Root cause
`brands` is a **global** catalog (no `business_id`) but carried four `TO public` policies of
the form `auth.uid() IS NOT NULL` for SELECT/INSERT/UPDATE/DELETE, and table grants gave
`anon` and `authenticated` full DML. Any signed-in tenant could rename or delete a global
brand referenced by `products.brand_id` and `supplier_brands.brand_id` of other tenants.

### Usage audit (evidence for keeping it global)
- `products.brand_id` → FK to global `brands`.
- `supplier_brands` (tenant-scoped, own `business_id` + RLS) → FK to global `brands.tier`;
  procurement supplier selection (`procurement-select-suppliers`, `n8n-select-suppliers`)
  reads `brands.tier`.
- `retail-iq-api` reads `brands:brand_id(id,name)` for export.
- Analytics group by brand (`get_top_sales_by_dimension` / `useSalesByDimension`).
- **No application code writes to `brands`** — no form, hook, or edge function performs
  insert/update/delete. Tier is a shared catalog attribute, not tenant data.
→ `brands` stays a global catalog; **no `business_id` added**, no per-tenant duplication.

### Exact changes
- Dropped the four permissive `TO public` policies.
- New policy `"Authenticated users can read brands"` — `FOR SELECT TO authenticated USING (true)`.
- `REVOKE ALL ON public.brands FROM anon;`
  `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ... FROM authenticated;`
  `GRANT SELECT ON public.brands TO authenticated;` `GRANT ALL ... TO service_role;`
- Added narrowest safe writer `public.create_brand_if_missing(p_business_id, p_name, p_tier)`:
  `SECURITY DEFINER`, requires `auth.uid()` + `is_active_business_actor`, validates name
  length (2–80, trimmed), case-insensitive dedupe, **insert-only** (returns the existing id
  when found). No update/delete path is exposed to tenants. Execute granted to
  `authenticated`, `service_role`; revoked from `PUBLIC`/`anon`.

### Before / after privileges on `public.brands`
| Role | Before (grants) | After (grants) | Before (policies) | After (policies) |
|---|---|---|---|---|
| anon | `arwdDxtm` | *(none)* | all four via `TO public` | none |
| authenticated | `arwdDxtm` | `SELECT` | SELECT/INSERT/UPDATE/DELETE | SELECT only |
| service_role | `arwdDxtm` | `ALL` | — | — |

Verified post-migration: `brands` ACL is `postgres=arwdDxtm | authenticated=rm | service_role=arwdDxtm`
(`m` = MAINTAIN, not a DML privilege).

---

## Migration safety
Single additive migration: `CREATE OR REPLACE FUNCTION` ×3, policy replacement on `brands`,
grant/revoke adjustments. **No table created, dropped, altered or recreated; no data
transformed; no column added.** Every block carries an inline comment stating security
intent. Existing tenants are unaffected because no application code exercised the removed
privileges.

---

## Tests / verification performed
- Function ACLs re-read post-migration: `execute_inventory_transaction`,
  `create_brand_if_missing`, `is_active_business_actor` → `authenticated`, `service_role`
  only (`anon` and `PUBLIC` removed).
- `brands` table ACL and policy set re-read post-migration (table above).
- Full call-site sweep: no frontend hook or edge function calls
  `execute_inventory_transaction` today (current inventory flows write through
  `inventory_actions` / `products` under existing RLS), and no code writes `brands` —
  therefore **no production behaviour changed**.
- Supabase database linter run as part of the migration: the reported warnings are the
  pre-existing project-wide set (extension in public, other `SECURITY DEFINER` functions,
  auth config). Neither of the two hardened areas adds a new finding.
- Typecheck + production build run clean.
- The repository has no SQL/regression test harness for RPCs, so authorization was verified
  by static privilege inspection rather than executed negative tests.

## Residual risk
- Negative-path assertions (cross-tenant / unauthenticated RPC calls) were verified by
  privilege and code inspection, not by an executed integration test — an automated harness
  is worth adding when Import receiving starts calling this RPC.
- `is_business_member` still contains its "temporary" owner fallback; the new helper does not
  depend on it, but the older function remains as-is (out of scope).
- Brand *creation* from the UI is currently impossible by design; if Phase 1 needs it, wire it
  to `create_brand_if_missing` — do not restore table-level grants.

## Remaining findings after this phase
- **P0:** none.
- **P1:** import cost privacy tables, `products` storage bucket policy, FX infrastructure,
  `quantity_in_transit` derivation — all deferred to later phases as instructed.
- **P2:** project-wide `SECURITY DEFINER` / linter cleanup, `is_business_member` fallback removal.

## Recommendation
**PASS** — Phase 1 Import infrastructure is safe to begin.
