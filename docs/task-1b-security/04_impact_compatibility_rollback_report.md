# Task 1B-Security — preparation-only authorization proposal

**Decision: NOT READY for execution. Prepared for review only.**

## Scope and evidence

Four files in this directory are the only requested deliverables. Task 1A
files, application code, existing migrations, billing, auth guards, branding
and production remain untouched. No SQL, tests or write probes were run in
this task. Production evidence below was obtained during the separately
authorized Task 1B SELECT-only inspection on 2026-11-09 around 14:55–14:57 UTC,
through the connected project `gtakgctmtayalcbpnryg`, as
`supabase_read_only_user` (BYPASSRLS). This is not a refreshed production read.

The observed PostgreSQL version was 17.4. Production registry had 145 entries,
latest `20260812121930`; local folder had 137 SQL files. Do not equate their
timestamps or use local source as proof of live definitions. `user_businesses`
exists, has `user_id UUID` primary key, `business_id UUID` FK and nullable TEXT
role; no `id`. Creation provenance remains unresolved.

## Exact vulnerability / root cause

1. `user_businesses` permits authenticated INSERT with only
   `user_id = auth.uid()`. Caller can supply an arbitrary business and role.
   The membership helper accepts the link, and import-management helper also
   accepts a link with a management role. No membership-table user triggers
   were found. This is a statically demonstrated authorization path, not a
   successfully executed exploit.
2. Both observed `business_users` INSERT policies only check caller identity;
   they do not enforce pending status or employee role. Supplying `approved`
   and `OWNER` can feed `is_active_business_actor` / import permissions.
   Removing only one duplicate policy would leave the other permissive OR path.
3. Owner UPDATE policies allow full-row changes. Without column restrictions,
   a manager can change membership identifiers or move an existing row rather
   than update its role/status. Proposed grants prohibit identity/tenant edits.
4. Products have explicit anon table INSERT/UPDATE grants, and postgres public
   default table ACL grants all API roles table privileges. Historical origin
   of the exact grant operation is unknown; the effective sources are verified.
   RLS currently limits rows but does not negate those column capabilities.
   Task 1A's fail-closed ACL check would abort. Fix table AND column grants,
   not RLS alone; do not alter shared default ACLs in this remediation.
5. Canonical inventory RPC's no-JWT branch trusts `current_user=postgres` inside
   SECURITY DEFINER. That describes its owner, not its caller. anon EXECUTE is
   currently false. The earlier role-setting-only replacement is WITHDRAWN:
   neither `current_user` nor `current_setting('role')` alone proves identity.
   No inventory body replacement remains in the corrected gated proposal.

Task 1B counts: zero approved members missing anchors, zero owners missing
anchors, zero nonowner anchors without approved membership, zero ledger and
checked import tenant mismatches. Counts do NOT prove each existing role/link
was legitimately approved; role equivalence and approval provenance need review.

## Caller inventory and intended provisioning

| Caller | Observed behavior / proposal impact |
|---|---|
| `src/pages/OnboardingDecision.tsx` | Calls `create_business_for_new_user`, then `complete_business_onboarding`. Neither RPC is modified. |
| Local business-creation RPC definition | DEFINER creates owned business, inserts own OWNER anchor, updates roles/profile. Existing owner provisioning must be confirmed against actual live definition before application. |
| `src/pages/CreateBusiness.tsx` | Legacy direct business INSERT then own `business_users` OWNER/approved INSERT. Actual-owner branch remains permitted. |
| `src/components/join-business/JoinBusinessForm.tsx` | Direct pending request, but sends free-text job title as `role`. Production CHECK permits only OWNER/EMPLOYEE; mismatch already exists. Hardened policy accepts only EMPLOYEE/pending for nonowners. No UI change included. |
| `src/pages/JoinBusiness.tsx` / route registration | JoinBusinessForm wrapper exists; current App route tree does not register join/create/onboarding pages. Intended deployed entry points remain unconfirmed; source presence is not runtime availability. |
| `src/hooks/useBusinessUsers.tsx` | Reads approved membership; no membership writer. |
| `src/hooks/useBusinessOnboardingStatus.tsx` | Reads own anchor fallback; SELECT policies unchanged. |
| `src/hooks/useBusinessAccess.tsx`, `useActiveBusiness.tsx` | Call frozen `get_user_business_context`; no change to contract/body. |
| Retail IQ `/employees` | Service client reads anchors; existing rows and trusted grants unchanged. |
| Three procurement webhooks | Service-side anchor reads for recipients; unchanged. |
| Existing SQL RLS / import / analytics callers | Membership helpers remain identical; all repository references located by exhaustive symbol search. No helper/admin-bypass rewrite. |

**Unresolved legitimate approval lifecycle:** no application caller that updates
membership status or synchronizes employee approvals into `user_businesses`
was found in the searched application/functions. Historical migration backfills
exist, not an ongoing provisioning flow. No membership-table sync triggers were
observed. Do not invent a new synchronization trigger or assume an external
system provisions links. Preflight must obtain all live functions mentioning
membership and confirm external callers / owner approval ordering.

The proposal preserves approved rows and helper semantics. Direct owner anchor
INSERT/role UPDATE for employees requires matching approved `business_users`
role; approve there first. Own OWNER anchor is explicitly supported. Primary
key `user_id` still restricts each anchor to one business; do not upsert/reassign
another business's anchor. These choices are conservative proposal defaults,
not user-approved changes to the operating model.

## Proposed minimal changes

- Replace all six observed membership INSERT/UPDATE policy paths with four
  narrowly scoped policies. Retain SELECT policies and existing helpers.
- Allow nonowner self-request only as EMPLOYEE/pending; actual owner may still
  register their own OWNER/approved row. Owner may update role/status, not IDs.
- Restrict trusted anchor creation to actual owner + own OWNER or matching
  approved employee. Deny direct API deletes / maintenance privileges on both
  membership tables; preserve existing service_role/DEFINER provisioning.
- Revoke anon/PUBLIC products INSERT/UPDATE, including explicit column ACLs;
  preserve authenticated and service product permissions and all product RLS.
- Revoke anon/PUBLIC EXECUTE on reversal (body unchanged). The other four
  reviewed inventory/import RPCs already deny anon and retain their ACLs.
- Withdraw the inventory dynamic replacement. The old MD5/strpos checks did
  not establish caller authentication or exact whole-source/contract retention.
- Add an unconditional readiness exception BEFORE all proposed DDL. The
  remaining policies/ACLs are review candidates only; removing this exception
  is not an authorized way to apply an incomplete security remediation.
- Add exact column-allowlist, forbidden table-capability and complete write-policy
  postconditions; inspect inherited/PUBLIC ACLs and all permissive OR paths.

No new table, trigger, role, RPC signature or reservation object is introduced.
No billing gate is added or removed. Existing platform-admin helper branches
are preserved; employee identities are not login roles.

## RPC evidence and compatibility

| Live RPC | anon / authenticated / service EXECUTE | Decision |
|---|---|---|
| Canonical 19-argument inventory RPC | false / true / true | Replacement withdrawn; authentication remains BLOCKED. |
| `reverse_inventory_action(uuid)` | true / true / true | Remove anon/PUBLIC EXECUTE; keep body and valid signed-in callers. |
| `import_receipt_confirm(uuid)` | false / true / true | No changes. |
| `import_receipt_correct(uuid,integer,text)` | false / true / true | No changes. |
| `import_order_close(uuid,uuid,jsonb)` | false / true / true | No changes. |

All five observed functions are DEFINER, owner postgres, search_path public.
Inventory live definition MD5: `cab73c49bb419f7e3dd5dab14f144e4b`.
Confirmation `eb00d0ce3ba1413517e8f303fad0ae2c`; correction
`47e0c074fb272484b34a09e6029ff751`; closure
`98474083a1cdc12dae4a1c7de6155313`; reversal
`2a3abac94664ba19a7ef2b2dc7de9946`. Refresh before execution.

Existing import definitions supply auth.uid and invoke the canonical RPC.
This is observed function-source behavior, not verified caller authentication
or runtime compatibility. This review does not change any no-JWT caller's
behavior, because the inventory replacement has been withdrawn. SQL Editor,
cron, service and external RPC callers require evidence before any change.

## Separate operational defects — NOT changed here

| Defect | Minimal recommendation and dependency order |
|---|---|
| Positive removal signs | 163 original nonreversed positive removes; 144 would yield negative stock now, none inside undo window. First identify intended semantics and canonicalize future writer signs; then separately validate reversal mathematics. Never blindly ABS/flip historical ledger. Five positive sales were not counted as original nonreversed defects. |
| Reversal owner role mismatch | Function checks owner/admin lowercase in business_users, CHECK allows OWNER/EMPLOYEE. Separately use actual businesses.owner_id and existing protected platform-admin check, retaining original-user and 10-minute rules; approval and isolated tests required. |
| Duplicate zero-stock triggers | Eight product triggers; two invoke notify_out_of_stock identically. After checking downstream consumers/duplicate handling, separately drop one redundant trigger, preserving one and all other notifications. No history cleanup in that change. |

Dependency order: secure membership authority + grants → separately approved
runtime/security validation → operational sign/owner/duplicate fixes → refreshed
Task 1A review → separately approved foundation. Reservations stay disabled
until later atomic-writer cutover regardless of this security proposal.

## Risks and execution gates

1. **Membership creation/approval flow is not fully verified.** User explicitly
   requires this before policy changes. All live DEFINER membership writers,
   legacy frontend entry points and external provisioning must be reconciled.
   Current proposal is NOT ready for execution until then.
2. Fresh approved SELECT-only preflight must confirm exact policies, function
   fingerprint, owners, role/column ACLs, inheritance, role mismatches, default
   grants and absence of new triggers. No queries were executed in this task.
3. Existing user_roles / profiles policies and writable businesses.owner_id
   have not received a full independent escalation audit here. They are trust
   dependencies; do not claim complete platform authorization hardening.
4. Link deletion/revocation synchronization is not implemented. Existing helpers
   accept retained anchors even after business_users approval is revoked. An
   approved revocation design is a separate lifecycle gate, not a hidden repair.
5. Service-role SQL caller behavior, future columns, API REST INSERT/UPDATE,
   legitimate join/owner provisioning and import/reversal behavior require
   separately approved isolated tests. No production write probes.
6. Unknown grant-option / delegation or custom role requirements must be checked.
   Proposal's fail-closed ACL checks do not replace baseline comparison.
7. Backup/restore readiness is unverified. Obtain a restorable backup, recovery
   procedure and quiet window before execution; do not initiate either now.
8. Frozen billing/auth files affected: **none**. get_user_business_context,
   trial/checkout/payment functions, subscription tables, App.tsx and auth
   hooks are read-only dependencies, never modified by this proposal. If a
   later compatibility fix needs any frozen surface, stop for freeze approval.

## Rollback / recovery

Before application, securely capture raw relation/column ACLs, owners, all
membership policies and exact canonical inventory body/ACL. Current source
files are not a rollback baseline. Save membership counts/fingerprints at a
quiescent point; no DML in this proposal changes those rows.

Failure before COMMIT is intended to roll back the whole transactional DDL;
that behavior has not been exercised. After commit, prefer forward-fix/read-only
maintenance if a caller breaks. **Do not restore arbitrary self-membership,
anon writes or the DEFINER-owner caller bypass as an automatic rollback.**
Any restoration requires separate security-reviewed approval and exact grants,
not GRANT ALL. No executable unsafe rollback script is provided. Data rollback
is unnecessary for this proposal, which has no INSERT/UPDATE/DELETE/backfill.

## Actions and stop point

Read uploaded instructions, relevant memory and freeze rules, repository callers,
local historical definitions and already captured Task 1B production outputs.
Created only these four preparation documents. No SQL execution, DB change,
tests, builds, write probes, UI/branding changes, Task 1A edits, reservation
activation, deployment or publishing. Execution remains separately gated.

Repository-save limitation: the environment requires a local Git commit for
these document edits despite the requested no-commit boundary. Any final local
commit must be explicitly disclosed; no agent push or deployment is performed.
A repository save is not production SQL execution or publishing.

## Final hardening review corrections

**Status remains NOT READY; the SQL draft now fails unconditionally before DDL.**
Only the four existing documents were corrected. No new production queries were
executed: this upload does not authorize even SELECT execution in production.
Task 1B tool results needed for new evidence are no longer retained in the
current sandbox. The previous in-chat definitions/counts remain cited evidence,
not a refreshed or complete production lifecycle audit.

### Lifecycle evidence matrix

| Stage | Repository evidence | Actual production evidence available | Decision |
|---|---|---|---|
| Business creation | OnboardingDecision calls create_business_for_new_user; historical RPC creates owner anchor and updates profile/roles | RPC existence was catalogued, complete current body was not captured in the prior displayed lifecycle evidence | BLOCKED: obtain exact live body, nested calls and deployed entry point |
| Owner membership | Legacy CreateBusiness inserts OWNER/approved for actual owner; historical atomic RPC inserts own anchor | businesses.owner_id fallback appears in actual membership helpers; zero owners missing anchors | Candidate preserves owner fallback; provisioning contract still BLOCKED |
| Employee request | JoinBusinessForm inserts pending with free-text jobTitle as role | Production business_users CHECK accepts OWNER/EMPLOYEE, INSERT policies only checked user_id | Existing mismatch identified; do not silently reinterpret job titles or activate a new model |
| Employee approval | No approval writer found in repository application/functions; historical backfill is not ongoing approval | No membership-table user triggers observed; complete live membership-writing RPC inventory missing | BLOCKED: authority, actor, transitions, role assignment and anchor ordering unknown |
| Employee revocation | No complete revocation/anchor-removal caller found | Existing helpers accept user_businesses regardless of pending/rejected/missing approval | FAIL for stale-link defense; BLOCKED on approved remediation/lifecycle evidence |

A valid owner-approved employee must retain access; a pending/revoked nonowner
must fail authorization even if an anchor remains. Current INSERT/UPDATE
policies cannot provide this invariant: they do not run on subsequent reads.
A precondition that finds zero stale links today also does not enforce it tomorrow.

### Stale-link dependency inventory and required closure

**Verified from Task 1B displayed production definitions:**
- is_business_member(uuid,uuid) accepts raw anchor or actual owner.
- is_active_business_actor(uuid,uuid) accepts approved business_users, raw
  anchor, actual owner or protected platform admin.
- can_manage_business_imports(uuid,uuid) accepts OWNER/admin anchor, approved
  manager, actual owner or protected platform admin.
- Product SELECT/INSERT/UPDATE/DELETE and inventory_actions SELECT/INSERT
  policies use is_business_member, sometimes plus can_business_write.
- Actual user_businesses INSERT/UPDATE policies allow self-link creation and
  owner update; actual business_users duplicates allow self-selected status/role.

**Repository/history candidates, NOT a verified current production inventory:**
- complete_business_onboarding, get_user_business_context (frozen),
  user_has_business_access, is_first_user_in_business, can_access_business_analytics
  and any wrappers discovered by recursive live definition review.
- Raw-anchor policies historically on categories (categories_select/insert/
  update/delete and older manage-category policy), suppliers (older manage-
  supplier policy), supplier_invoices (member read), supplier_preferences and
  category_supplier_preferences. Later migrations may supersede these;
  catalog inventory, not file timestamps, must identify the active set.
- Import tables/storage policies call can_manage_business_imports; all must be
  included transitively even where no raw anchor occurs in their own predicate.
- useBusinessOnboardingStatus reads anchors; Retail IQ employees and three
  procurement webhook recipient readers use service-side raw anchors.

The corrected preflight enumerates ALL public functions, policies, views,
materialized views, rules and catalog dependency edges containing these links
or helpers. Text searches/pg_depend cannot prove dynamic/nested/external call
completeness: recursively inspect exact bodies and deployed callers. **Complete
live helper/RLS inventory remains BLOCKED; no claim of exhaustive production
closure is made.**

Required successor design must either enforce current owner/approved membership
on every raw/helper read path or implement a verified atomic lifecycle that
prevents any stale link from authorizing, including trusted provisioning paths.
Just changing the three helpers misses direct raw-anchor policies and service
readers. A sync trigger alone cannot be invented before proving approval and
revocation semantics. Do not alter protected platform-admin behavior or frozen
get_user_business_context without separate freeze review/approval.

### Inventory caller boundary — what is proven vs proposed

**Proven statically from earlier actual definitions:** anon lacks EXECUTE on
canonical inventory and three import mutations; reversal permits anon EXECUTE
but rejects missing auth.uid. All five are DEFINER owned by postgres. Existing
import confirmation/correction propagate auth.uid and canonical calls. No runtime
identity or tenant rejection has been proven.

**Required, not yet proven:** Supabase/PostgREST validates caller JWT and sets
request identity; canonical signed-in operation must bind p_user_id to auth.uid
and authorize that user via actual owner, CURRENT approved membership or
existing protected system-admin identity. auth.uid/request claims are trusted
only behind an established JWT-validating ingress and restricted SQL access;
a caller-controlled SQL GUC is not an independent identity proof.

For no-JWT server jobs, require a separately verified, restricted execution
principal or trusted server handler with explicit business/actor authorization.
Do not implement a broad service-role-name/GUC bypass. Missing evidence about
such callers means BLOCKED, not permission to disable them or trust their role
label. Existing import business logic and authenticated signature must survive.

### Safe replacement requirements

The earlier dynamic replacement is removed, not merely relabelled safe.
Before any successor changes inventory authentication:
1. Capture exact canonical pg_get_functiondef text and full pg_proc identity,
   owner, security mode, argument names/types/defaults, return type, search_path
   and ACL. Fingerprint is a drift signal, not exact-source proof.
2. Approve exact old/new source text, require each replaced block occurs once,
   and reject any source mismatch before DDL. No broad global replace.
3. Lock the maintenance/application window against concurrent definition changes;
   take an immediate pre-change comparison, execute in one transaction, and
   compare exact resulting source and all unchanged contract/privilege fields.
4. Use CREATE OR REPLACE on the same signature, never DROP/recreate, overload,
   GRANT ALL or default-based permission reconstruction. Assert effective anon,
   authenticated and service EXECUTE after replacement.
5. Roll back on any mismatch; run separately approved isolated identity/tenant/
   import compatibility checks before controlled production application.

### Remaining controlled-execution gates

- Separate authorization to read production; exact current lifecycle writers,
  owner approval/revocation entry points and all stale-link consumers.
- Explicit intended employee role/status model; free-text job title is not an
  authorization role. No silent frontend/business-model changes.
- Revocation invariant across helpers, raw RLS, views and service consumers.
- Verified inventory ingress and any trusted no-JWT execution path.
- Exact-source/contract/ACL replacement proposal and isolated validation.
- Backup/restore readiness, freeze approval where a shared frozen path is needed,
  refreshed compatibility review and explicit execution approval.

**No READY claim is permitted while any of approval, revocation or caller
identity is unresolved.** The policy candidate does not satisfy complete
employee security; the unconditional SQL gate prevents accidental application.
