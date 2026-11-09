# Mlaiko — Task 1A: additive foundation proposal

**Status: PREPARATION ONLY. No SQL executed; no migration applied.**

## Exact deliverables

1. `docs/task-1a/01_additive_foundation.proposed.sql` — proposed transaction, deliberately outside managed migration history.
2. `docs/task-1a/02_preflight.readonly.sql` — SELECT-only baseline/catalog checks; not executed.
3. `docs/task-1a/03_verification.readonly.sql` — SELECT-only post-application checks; not executed.
4. `docs/task-1a/04_migration_impact_report.md` — this impact, compatibility, rollback and blocker report.

Earlier preparation also changed `roadmap.md` and `AGENTS.md`; their exact diffs and the subsequent north-star addition are recorded below. This correction task modifies ONLY these four review files; none of those outside changes is reverted. No application files, icons, manifests, page titles or existing migrations edited.

## Evidence and limits

This review is **static repository inspection**, not a fresh production inspection. The supplied baseline (853 products, zero negative quantities, 306 NULL costs, 31 zero costs, 119 NULL selling prices) is historical evidence only. These figures must be refreshed after approval. Do not infer current production state or applied migrations from local SQL alone.

Inspected sources:

| Source | Relevant evidence |
|---|---|
| `src/integrations/supabase/types.ts` | Product physical quantity; nullable costs/prices; current business/user relationships and inventory provenance columns; no reserved column or employee/reservation tables |
| `20250617185206-c44e1d45-f185-46f9-9475-f76b688c167b.sql` | Initial products and inventory ledger, product/supplier/business/user FKs; inventory actions originally delete-cascade from product |
| `20250622183731-2db8cf88-116e-46eb-a1dc-925c1ff16976.sql` | Approved/pending business membership and owner context |
| `20260510184344_d11f6677-da96-4214-99c2-965ce3162055.sql` | `is_business_member`: owner or `user_businesses`, no automatic global admin bypass |
| `20260810120346_7cd95d48-d20c-4960-9e2a-57f263ea1cda.sql` | Broader `is_active_business_actor`: approved `business_users`, owner, `user_businesses`, platform admin |
| `20260810130007_e160bb9b-a1a2-4197-b824-e961f99e4d1a.sql` | Current 19-argument inventory RPC; receipt confirmation/correction; ledger provenance; import receiving writes stock through canonical RPC |
| `20260811062416_e9ca1839-8b2c-4a2f-b80f-063c38ea125b.sql` | Import closure modifies weighted cost without rewriting historical snapshots |
| `20260720082218_810179f6-6b48-4840-ba6d-4e4a08af6180.sql` | Latest local reversal function restores stock and records reversal |
| `src/components/inventory/EditProductDialog.tsx:140–268` | Direct product quantity/cost update followed by separate sale/purchase ledger insert |
| `src/hooks/useProducts.tsx:132–166` | Direct update followed by separate inventory log |
| `CODE_FREEZE_SUBSCRIPTION.md` | Billing/access surface must remain unchanged |

Migration filenames use timestamp prefixes plus dash/underscore identifiers. Latest local migration is `20260812121930_d26efe87-38de-4947-b52e-1f647f96f8c7.sql`. The proposal has no executable migration version: assign one through the migration tool at eventual approval, after reconciling the actual deployed registry. Do not copy this file into `supabase/migrations` manually.

### Repository dependency verification (static only)

| Preflight dependency | Local creation/column evidence | Production status |
|---|---|---|
| `products.id/quantity/cost/price/business_id` | `20250617185206-c44e1d45-f185-46f9-9475-f76b688c167b.sql`: quantity INTEGER NOT NULL DEFAULT 0, nullable costs/prices | Unverified; approved catalog inventory required |
| `inventory_actions.id/product_id/business_id` | Same initial migration; queries do not require later provenance fields | Unverified |
| `businesses.id/owner_id` | Same initial migration | Unverified |
| `business_users.status/user_id/business_id/role` | `20250622183731-2db8cf88-116e-46eb-a1dc-925c1ff16976.sql` | Unverified |
| `profiles.id` | `20250617174058-08b668ac-3765-43b4-9ed4-85b3decc1991.sql`; used only as catalog relation | Unverified |
| `user_roles.user_id/role` | `20250617182328-b957f553-6c32-42da-80d6-9ffb17ac0d9b.sql`; dedicated role table used by existing helpers | Unverified |
| `user_businesses.user_id/business_id/role` | **No CREATE TABLE found in repository SQL.** Types expose these three columns (no `id`); later migrations ALTER/query the table, e.g. `20250708101656-4b732f51-24d0-4266-ab7e-b592a4045ef0.sql`. This is an external/baseline schema dependency, NOT verified effective creation history. | **Blocker: establish existence, column types, constraints, policies and creation provenance** |
| `anon/authenticated/service_role` and migration registry | Supabase platform dependencies, not created by this proposal | Role/catalog visibility and applied registry unverified |

No later DROP/RENAME of the listed required relations/columns was found in local migration inspection; that is not a successful replay or proof of deployed state. Catalog queries use PostgreSQL catalogs rather than invented application columns. `02_preflight` now starts with `to_regclass` and column/role inventory; run this section first after approval and stop if any dependency is absent before executing dependent SELECTs. A missing `user_businesses` must not be silently interpreted as zero membership mismatches. Catalog function inventory may return no rows for a missing function: required helpers/signatures must be reconciled explicitly.

Corrected PostgreSQL ORDER BY expressions: a SELECT output alias cannot be cast inside a new expression (`relation::text`, `child_relation::text`, `signature::text`); catalog expressions are now repeated instead. Static inspection only, not SQL execution validation.

### Corrections to previous preflight interpretation

- Zero rows in `information_schema.role_table_grants`, `column_privileges`, or `triggers` **do not prove absent grants/triggers**; visibility depends on the inspection role. Do not describe this as permissions automatically granted by a PostgREST wrapper.
- Repository history creates product audit, notification and out-of-stock triggers. A prior report of zero product triggers conflicts with that history. Fresh `pg_trigger` results with adequate visibility must settle this before approval to apply.
- RLS force flag is `pg_class.relforcerowsecurity`, not a `pg_tables.forcerowsecurity` column. The prepared queries use the proper catalog.

## Proposed schema and exact scope

### Employees

`public.employees`: UUID identity, business FK, trimmed display name (1–120 characters), active flag, immutable creator and creation time, server-maintained update time. No login account, PIN or role field.

Names unique case-insensitively per business, including inactive employees, to avoid identity reuse. Active lookup index supports sale-time selection. Same names can exist in different businesses. Identically named people in one business require distinct display names; reactivation uses the original UUID. This policy is a proposed default, not a production fact.

Creation audit uses a plain user UUID, not a new FK into `auth.users`. Historical attribution survives user-account removal. Sales-to-employee links and sale-time name snapshots are a later task, not silently added here.

### Reservations

`public.inventory_reservation_operations` provides a stable, tenant-bound operation identity and unique `(business_id, reference_type, reference_id)` provenance key.

`public.inventory_reservations` links `(business_id, product_id)` to a composite product key, and `(business_id, source_operation_id)` to a composite operation key. A product cannot be attached to another tenant's source operation, even through service-role writes. Original reservation per operation/product is unique; repeated business lines for the same product are aggregated by a future writer, or a future typed line key must be added.

Quantities:

```text
original > 0
remaining >= 0; fulfilled >= 0; released >= 0
original = remaining + fulfilled + released
```

Partial handover example: reserve 10 → hand over 4 → remaining 6, fulfilled 4, released 0 → cancel remainder → remaining 0, fulfilled 4, released 6. Cancellation never subtracts already fulfilled stock a second time. Another valid transition: release 2 and then fulfill 8, without marking the release as cancellation. Original/source identity is immutable; fulfilled/released counters only increase, remaining only decreases; terminal reservations cannot reopen. Changes use server timestamps and attributed business-member UUIDs. Cancellation must release exactly the previously remaining balance. BIGINT arithmetic avoids overflow when adding INTEGER counters.

External `reference_id` is explicitly **informational**, not a polymorphic FK to an unknown supplier-handover table. Real future domain links need typed composite FKs before use. No supplier table link is invented.

Deletion is restricted to preserve employee/source/reservation audit identities. This introduces a deliberate dependency for any future business-deletion workflow; no such workflow is changed here.

### Product stock

- Add `reserved_quantity INTEGER NOT NULL DEFAULT 0`; all existing products initially have reserved zero.
- Keep `quantity` physical stock.
- Add immutable arithmetic bounds: `0 <= reserved_quantity <= quantity`, also prohibiting negative physical quantity.
- Add unique `(business_id, id)` to permit tenant-safe composite FKs; original PK remains unchanged.
- Available stock is calculated as `quantity - reserved_quantity`; **no independently writable available-stock column/view**.
- **Effective PostgreSQL privileges:** snapshot authenticated INSERT/UPDATE capability per existing product column, revoke direct table-wide INSERT/UPDATE, then regrant only those legacy columns that were effectively writable. Exclude `reserved_quantity`. A column REVOKE alone cannot override a table GRANT.
- Abort the whole proposed transaction if anon/PUBLIC reserved write access exists or authenticated effective reserved access remains through inherited/shared grants. Do not automatically revoke shared-role grants or broaden permissions. Preflight inventories ACLs/inheritance; verification compares all legacy column capabilities.
- **Dormant trusted-writer boundary:** the SECURITY INVOKER trigger allows INSERT with reserved zero/default and UPDATE with reserved unchanged, but rejects every balance change, including service-role and existing DEFINER-owner writes. No role-name allowlist, JWT claim or caller-controlled GUC bypass exists. New reservation/source-operation INSERTs are also blocked by their existing proposed triggers, so privileged accidental activation cannot bypass dormancy through table DML.
- Database owners/superusers can disable triggers and are outside the security boundary. They are expressly prohibited from activating positive reservations in this phase. No trusted reservation mutation endpoint is introduced; a later approved cutover must establish an isolated, non-client-writable atomic writer boundary before lifting these blocks.

Legacy physical quantity/cost writes remain permitted where previously authorized; their ACL **shape** changes from table-level to legacy-column grants where applicable. Existing import/reversal DEFINER functions need no body/signature/owner change because they leave reserved unchanged. New client product INSERTs must omit `reserved_quantity` (default zero); explicitly naming it, even as zero, is denied by column privileges. Future columns do not inherit blanket client write access. Effective legacy-column capability must match the preflight baseline, but grant-option/delegation preservation and any shared-role assumptions require separate review; this proposal makes no claim that raw ACL text is unchanged.

### Cost compatibility

No modification to `products.cost`, `price`, their nullability, historical costs, sale snapshots or movement rows. No zero backfill. No latest-cost/latest-receipt field is added: it is unnecessary for this data-only foundation.

A future `latest_purchase_unit_cost_ils` would mean actual latest accepted receipt unit cost, **not** weighted inventory valuation and **not** automatically final import landed cost. It requires an accepted-receipt ordering/tie-break rule, typed tenant-scoped receipt provenance, missing-cost behavior, correction semantics, and import provisional-versus-final treatment before an additive field/writer migration is approved. Existing rolling-average cost stays authoritative meanwhile.

## RLS and authorization

| Resource | Authenticated read | Authenticated write | Backend |
|---|---|---|---|
| Employees | `is_business_member(business_id, auth.uid())` | Actual business owner only; INSERT business/name/active, UPDATE name/active; no DELETE or creation-audit writes | service_role grants all; audit validations still apply |
| Reservation operations | Same membership helper | None, including balances/provenance | service_role grants all; INSERT is blocked while dormant; provenance immutable |
| Reservations | Same membership helper | None | service_role grants all; INSERT is blocked while dormant; tenant FKs/validation apply |

All new public tables follow **CREATE TABLE → GRANT → ENABLE RLS → policies** in the same proposed transaction. Anonymous/PUBLIC table access is revoked. Exactly **four new trigger functions and four new triggers** (`task1a_guard_reserved_column` / `trg_task1a_reserved_column`, `task1a_employee_audit` / `trg_task1a_employee_audit`, `task1a_reservation_operation_audit` / `trg_task1a_reservation_operation_audit`, `task1a_reservation_validate` / `trg_task1a_reservation_validate`). All four trigger functions have explicit locked search path, invoker security and revoked direct EXECUTE for PUBLIC/anon/authenticated. None is a client-callable inventory mutation RPC.

**Membership/management comparison:** `is_business_member` accepts the actual owner or a `user_businesses` row, without requiring approved `business_users` status. `is_active_business_actor` also accepts approved `business_users` and global admins. `can_manage_business_imports` additionally permits approved business managers (`OWNER`/`admin`), user_businesses managers and platform admins. These helpers are NOT interchangeable. Employee read/actor checks retain the existing strict membership helper; employee writes retain actual-owner-only authorization. No manager/admin permissions are added, no helper is redefined, and no membership rows are repaired. A `user_businesses` row whose approval was revoked can still satisfy this helper; inconsistent membership lifecycle is a pre-existing dependency requiring production reconciliation, not silently repaired here. Any broader or different employee access policy needs explicit approval.

Employee management uses owner identity from `businesses.owner_id`, not user-editable role metadata. No existing admin bypass or membership/billing helper is changed. Owner-only management is intentionally conservative: enabling other managers requires separate scope approval. Existing billing helpers are not extended/redefined/invoked by new policy design; whether employee management should follow billing gates is outside this proposal and requires freeze review before implementation.

Plain actor UUIDs are checked for current membership on creation/update; old creator identities are preserved, not revalidated after staff depart. Trusted backend writes without JWT still must attribute a real current business member. Service role is trusted and bypasses RLS by design; database owners can disable triggers and are outside the client security boundary.

## Impact and compatibility

**At foundation application with empty reservations:** bounds reduce to `quantity >= 0` while reserved is zero. Compatibility is statically conditional, not E2E-verified:

| Current flow | Evidence and zero-reservation behavior |
|---|---|
| Import confirmation | `import_receipt_confirm` calls 19-argument `execute_inventory_transaction` with positive received units; RPC writes quantity/cost only and already rejects resulting negative stock. Reserved stays zero. |
| Import correction | Positive `add` or negative neutral `adjust` uses same RPC; resulting stock must remain >= 0, as before. Existing correction prerequisites remain unchanged. |
| Import closure | `import_order_close` updates weighted cost/price, not reserved; no new bound restriction for existing valid stock. |
| Reversal | Latest `reverse_inventory_action` computes `quantity - quantity_changed` for sale/remove. A **negative** signed movement restores stock and passes bounds. Legacy `useProducts` logs `abs(quantityDiff)` even for remove, so an incorrectly positive remove can reduce stock on reversal and may now be rejected if negative. This existing sign inconsistency is NOT fixed here; review actual reversal data before application. |
| Product editing/creation | Edit dialog writes explicit legacy columns; hook writes supplied product fields; current typed payloads have no reserved field. Nonnegative quantities still pass. Negative client quantities, previously possible without a bound, now fail intentionally. Absolute stale writes/separate movement logging remain unsafe but unchanged. Uninspected external writers or full-row payloads naming reserved require validation. |

No existing RPC signatures, definitions, owners, RPC ACLs or RLS policies change. Only product direct INSERT/UPDATE grants are narrowed to preserve existing-column effective permissions and deny the new column. Static checks cannot establish runtime behavior of REST/upsert, inherited roles, triggers or external integrations.

**Not an operational reservation system yet:** no public create/fulfill/release RPC, no balances written, no automatic sum-sync trigger or reservation event ledger. Aggregate equality `products.reserved_quantity = SUM(remaining_quantity)` is NOT enforced for privileged ad hoc writes by this preparation. New source/reservation INSERTs and reserved balance changes are hard-blocked by the proposed triggers until an approved atomic writer phase; privileged trigger disabling/bypassing is forbidden. This is an explicit activation blocker, not a claim of complete synchronization.

Future atomic writers must lock product before reservation rows in deterministic order, validate available quantity, update aggregate and reservation together, record each fulfillment/release with actor and idempotency key, enforce source-domain FKs and link resulting movement in the same transaction. Partial fulfillment reduces physical AND reserved by the handover quantity; release reduces reserved only. They must validate server-side tenant permissions on every call; clients never write counters directly.

**Legacy write risks:** UI uses stale absolute quantity and separate log requests. Bounds will reject stock below reserved once reservations are active, but do not eliminate stale overwrites, lost updates, financial logging gaps, or inventory changes without history. Future receiving corrections can also be rejected when resulting physical stock would be below reserved; that needs an approved reservation-aware correction/cutover policy. No stock-write lockdown is activated here, and positive reservations must remain disabled until cutover.

**Existing security risk, not changed:** local `execute_inventory_transaction` is SECURITY DEFINER and includes a no-JWT branch accepting its effective `current_user` (typically owner `postgres`). Its existing anonymous EXECUTE revocations therefore matter; a role-name branch alone is not a general authentication proof. The new reserved-column guard blocks even privileged effective balance writers, but cannot secure an existing broadly callable DEFINER function against unrelated legacy stock manipulation. Inventory alloca­tion must not be activated until reachable DEFINER writers are reviewed. `reverse_inventory_action` was previously reported executable by anon/PUBLIC despite rejecting null `auth.uid`; this proposal does not revoke its existing privilege because its compatibility boundary is frozen.

**Locks/performance:** ADD COLUMN with constant default is normally metadata-only on modern PostgreSQL, but ALTER TABLE acquires strong locks; validated CHECK scans product rows and UNIQUE builds an additional index. Transactions use 5-second lock timeout and 60-second statement timeout and roll back on timeout. Snapshot 853 rows is small, not a promise of current size/load. Schedule an approved quiet window. Do not silently retry indefinitely.

**API/type impact:** additional product field appears on SELECT `*`; old clients should tolerate additive fields, but strict consumers must be checked. No generated `types.ts` edit is allowed. New tables stay unused by current UI. Regenerate types via supported tooling only after approved application.

## Compatibility and rollback analysis

1. If the transaction fails before COMMIT: ordinary PostgreSQL transactional DDL rolls back proposed objects/default/constraints; no partial migration should remain. This is not a tested guarantee for the live environment.
2. If committed but never used: a separately approved rollback must also restore the exact preflight product ACL baseline (without widening existing privileges) and may remove new triggers/functions, empty reservation tables, empty employees, the composite product key, stock bounds and reserved column, in dependency order. Compare counts/dependencies first. No executable destructive rollback script is provided.
3. If employees or reservation history are populated: no automatic table drop; preserve/export identities and audit before evaluating a separate migration. RESTRICT prevents casual cascades but privileged TRUNCATE remains trusted administrative access.
4. After any positive reservation or new transaction exists: do not remove stock protection or reopen legacy direct writes. Use forward-fix or read-only maintenance; dropping counters or reconstructing physical stock from reservation counters is unsafe.
5. No historical costs/movements or original RPC bodies are rewritten, so there is nothing to backfill/revert in those objects. Product INSERT/UPDATE ACLs are the deliberate exception to the prior no-ACL-change claim.

## Remaining blockers and acceptance gates

### Before applying this foundation

1. **Explicit execution approval is missing.** This task authorizes preparation only.
2. **Fresh preflight/catalog reconciliation missing.** Prepared queries must be approved and run; reconcile actual grants/role inheritance, function owners, product triggers and deployed migration registry. Previous visibility-limited results are insufficient.
3. **Security and compatibility validation not performed.** User prohibited running tests without approval. Future approved staging checks must prove tenant mismatch rejection, owner-only employee writes, client reserved-write rejection (including REST table grants), bound violations, partial fulfillment/cancellation transitions and unchanged real import confirmation/correction/closure/reversal.
4. **Membership mismatch unresolved.** Approved `business_users` without `user_businesses` may pass import helper but fail new RLS/member actor checks. Prepared counts identify this; no membership data is repaired here.
5. **Source/role/default-grant assumptions require reconciliation.** Confirm effective product permissions before/after narrowing, inherited/PUBLIC grants, any grant-option/delegation requirements, migration-role authority to revoke/regrant, and actual function/table ownership. Existing anon/PUBLIC or residual authenticated reserved writes cause a fail-closed abort, not automatic shared-role modifications.
6. **Undocumented schema dependency:** `user_businesses` creation is absent from local migration history. Confirm deployed columns/constraints/creation provenance before approval to apply.
7. **Reversal sign/external-writer compatibility:** refresh count-only diagnostics for positive signed sale/remove movements and review impacted records securely; no new data query was run in this task. Approve validation of actual REST product create/edit, imports, reversal and strict external consumers before application.

### Before activating reservations (not required to prepare schema)

- Atomic reserve/partial fulfill/release/cancel RPCs, aggregate synchronization, event ledger and idempotency/typed source links are absent by design.
- **Positive reservations are expressly prohibited until ALL legacy inventory writers (UI, hooks, imports/corrections, reversals, external/DEFINER writers) are migrated to reservation-aware atomic paths or safely blocked.** A bounds CHECK alone is not cutover. Do not lift dormancy triggers before this gate. Reservation-aware import correction/reversal policy is pending.
- Employee sale attribution and any expanded employee management permissions are a later approved task.
- Business deletion handling with RESTRICT and external API additive-field compatibility require review.

## Exact corrections and outside-file review

Corrections in this task: effective product column ACL narrowing with fail-closed inheritance checks; universal dormant balance/source/reservation insert blocks instead of a current_user allowlist; dependency/role inventory and missing user_businesses creation disclosure; valid catalog ORDER BY expressions; four-function/four-trigger count queries; conditional import/reversal/edit compatibility including signed-remove risk; unchanged conservative employee RLS with explicit membership differences; product-ACL rollback requirement and activation prohibition.

Changed files are exactly the four deliverables listed above. Before these corrections the working tree was clean. Earlier preparation commit `e2019fc305beb004859d89e8581866fe4f19926c` changed AGENTS.md and added roadmap.md; subsequent `cae30acac61d401a7dbcb7811e7c5a6453a8019c` added `.lovable/north-star/north-star.md`. These are outside the four-file scope and remain untouched. Exact zero-context Git diffs (including original no-final-newline markers):

```diff
diff --git a/AGENTS.md b/AGENTS.md
index 02783e2..130edff 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -4 +4,2 @@
-- Derive install icons from the existing favicon as full-bleed squares served as real files (/apple-touch-icon.png, /icons/*); iOS requests that root path directly.
\ No newline at end of file
+- Derive install icons from the existing favicon as full-bleed squares served as real files (/apple-touch-icon.png, /icons/*); iOS requests that root path directly.
+- Keep unapproved SQL proposals outside supabase/migrations; the migration tool owns executable migration history, preventing accidental deployment of preparation-only work.
\ No newline at end of file
diff --git a/roadmap.md b/roadmap.md
new file mode 100644
index 0000000..31fe958
--- /dev/null
+++ b/roadmap.md
@@ -0,0 +1,8 @@
+# Task 1A — preparation only
+
+- [x] Inspect repository schema, migration ordering, membership helpers, legacy writes and import dependencies.
+- [x] Prepare additive SQL proposal outside the managed migration directory.
+- [x] Prepare read-only preflight and verification SQL; do not execute either.
+- [x] Document impact, authorization, compatibility, rollback and remaining blockers.
+- [x] Statically review prepared deliverables; no tests, database execution or publishing.
+- [ ] Apply migration — blocked pending explicit approval, refreshed preflight and compatibility/security validation.
\ No newline at end of file
diff --git a/.lovable/north-star/north-star.md b/.lovable/north-star/north-star.md
new file mode 100644
index 0000000..19d38cf
--- /dev/null
+++ b/.lovable/north-star/north-star.md
@@ -0,0 +1,9 @@
+<!-- Lovable wrote this file; it is not part of your task. Keep it, and ask the user before deleting or reverting it. -->
+
+# המצפן
+
+בעלי עסקים יודעים בדיוק איזה מלאי יש להם וכמה הוא מרוויח להם
+
+## מדד
+
+מכירות שנרשמו מול המלאי בכל יום
```

**Readiness:** ready for an **approval-gated migration review**, NOT ready for execution or reservation activation. The static corrections are complete; the preceding production/schema/privilege/compatibility blockers must be cleared under explicit approval. No PostgreSQL execution or runtime validation is claimed.

## Execution confirmation

No SQL was executed, no business RPC invoked, no database/permission/data change applied, no tests run, no deployment or publishing performed, and no UI/branding changed. Prepared SQL was statically reviewed only and is **not validated by a PostgreSQL execution**. Existing managed migrations and import/inventory/report/billing source files are untouched.

Repository save note: only the four corrected review files are committed locally as required by the environment. No push command is issued by this agent; repository synchronization is platform-controlled. Saving proposals is not SQL execution, deployment or publishing.

**STOP: await explicit approval for the next step. No SQL execution is authorized by this report.**