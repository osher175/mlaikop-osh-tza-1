# Task 1B — implemented subset and blocked boundaries

**LOCAL SQL IMPLEMENTED; NOT READY; NOT APPLIED TO PRODUCTION.**

Canonical candidate: `01_independent_acl.proposed.sql` (the existing filename is retained to avoid another report set). It now contains explicit membership/helper/category DDL followed by the independent ACL slice. This supersedes the earlier unconditional-gate draft in `docs/task-1b-security/`; do not concatenate or execute both candidates.

## Implemented authorization rules

- `businesses.owner_id` establishes ownership; membership-table OWNER labels do not.
- `is_business_member(uuid,uuid)` checks actual owner or current approved `business_users`, never `user_businesses`. Conflicting approved/nonapproved duplicates deny a nonowner; the candidate also aborts if duplicate pairs already exist.
- `is_active_business_actor(uuid,uuid)` uses that current membership check and retains its existing protected `user_roles.admin` exception. `is_business_member` does not gain an admin exception.
- `can_manage_business_imports(uuid,uuid)` uses actual ownership or a currently approved `business_users.admin`, retaining its existing platform-admin exception. Nonowner OWNER rows abort preflight rather than silently removing potentially legitimate management access. Production's OWNER/EMPLOYEE CHECK means business admin creation is not introduced by this task.
- New **RESTRICTIVE** INSERT/UPDATE gates AND with all existing permissive membership policies. Both duplicate INSERT paths remain subject to the same pending/EMPLOYEE rule; no broad new permissive policy grants approval.
- Actual owners retain their own OWNER/approved insertion. Nonowners can only self-request EMPLOYEE/pending. Existing owner UPDATE paths can change employee status/role only within their business; user/business identifiers have no UPDATE grants. Nonowner OWNER assignment is prohibited.
- Anchors can be written only by the actual owner for self or an already approved EMPLOYEE. They no longer independently authorize the replaced helpers.
- Category restrictive ALL gate prevents raw-anchor permissive policies from authorizing a nonmember in USING and WITH CHECK. Existing global NULL-business categories and existing financial write gates remain unchanged.
- Anonymous product table/column writes and reversal EXECUTE are removed with effective privilege postconditions. Signed-in/service product and reversal privileges are preserved exactly or the transaction aborts.

No membership data is repaired, approved, deleted, backfilled or synchronized. Approved-row provenance is still an unresolved trust prerequisite. Restrictive policies do not constrain a BYPASSRLS service client or postgres-owned DEFINER writer.

## Verified repository workflows (static, not E2E)

| Path | Evidence | Treatment |
|---|---|---|
| Import center/detail | `src/App.tsx` registers `/import` and `/import/:id` | No UI or route changes |
| Receiving | `src/hooks/useImportReceiving.tsx` invokes confirmation/correction | RPC contracts unchanged |
| Internal receipt mutations | `20260810130007...sql` confirmation/correction call canonical inventory using `v_caller := auth.uid()` and matching `p_user_id` | Caller propagation preserved; runtime unverified |
| Atomic owner creation | `20260214205127...sql` creates business with caller owner_id, then own OWNER anchor, roles/profile | Owner fallback supports this ordering; DEFINER writer unchanged |
| Legacy owner creation | `src/pages/CreateBusiness.tsx` inserts owned business then own OWNER/approved membership | Matching insertion remains allowed if reached; no active route found |
| Progressive onboarding | `OnboardingDecision.tsx` calls create-business then complete-onboarding | No registered route found; complete-onboarding authorization change BLOCKED |
| Join request | `JoinBusinessForm.tsx` inserts pending with free-text jobTitle as role | Existing CHECK mismatch; no active route found, so do not invent a new workflow or modify UI |
| Approval/revocation | Existing owner RLS UPDATE policies permit role/status change; no app approval/revocation writer found | Gate constrains existing permission, does not add an endpoint |

Operational sales-attribution employees do not require app accounts. No employee-login/invitation functionality is added.

## Exact dependent changes STOPPED

1. **Canonical inventory SECURITY DEFINER replacement:** local 19-argument source is available, but the previous production report explicitly states 145 registry entries versus 137 local SQL files and provides only fingerprints here. Complete current body/default/ACL parity and actual no-JWT caller inventory are not proven. Do not replace live financial logic from historical source. The unsafe no-JWT current_user branch remains in production; this subset does NOT fix it. No role/GUC/p_user_id bypass is proposed.
2. **Authenticated target boundary:** require verified JWT-validating PostgREST ingress and restricted SQL access, caller `auth.uid()` bound to actor, supplied mismatch rejection (subject to caller compatibility), current membership/product tenant match, no-JWT rejection unless a separately proven restricted server path exists. No invented cron/service callers.
3. **Complete onboarding replacement:** historical body updates onboarding state and inserts default notification settings including plan_limit_enabled. Exact current source and frozen-path impact are not proven; no function replacement or new billing behavior is included.
4. **Analytics and all stale-link closure:** historical analytics helper includes a service-role branch, protected has_role_or_higher, raw anchors and approved members. Exact live contracts/consumers are not established by supplied findings. No silent replacement of server read authority. Other raw anchor consumers and views require approved evidence, not another unapproved discovery run.
5. **Frozen get_user_business_context:** unchanged. Altering business selection/auth or existing admin/billing behavior needs the freeze review and explicit approval.
6. **Service readers:** Retail IQ employees and three procurement webhook recipient readers use elevated raw-anchor reads. Their business/employee contracts are not assumed equivalent to application membership. Unchanged and BLOCKED for system-wide closure.
7. **Reversal current-actor membership:** only EXECUTE ACL is changed. Exact live body is not preserved in the evidence package; its actor path and OWNER/lowercase mismatch remain BLOCKED for a separate explicit replacement. No reversal arithmetic is changed.

## Review/application boundary

The SQL is a deterministic **partial** transactional implementation, not an executable complete-system approval. No unconditional exception hides implemented DDL. Its duplicate/nonowner-OWNER/trigger and effective-ACL guards abort incompatible baselines. Existing API SELECT grants and DEFINER/service provisioning are retained. Unknown restrictive policies may still deny valid workflows; unrestricted trusted writers may still manufacture approval. The package is therefore NOT READY for application.

Before any application: reconcile exact live baseline, protected ownership/role writer authority, approved-row provenance and full authorization closure; obtain isolated validation and execution approval. No source fingerprint alone constitutes that evidence. Preserve all financial formulas, row locks, provenance, optional defaults and return shapes during the eventual explicit whole-function replacement.
