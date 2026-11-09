# Task 1B — local implementation report

**Overall: BLOCKED / NOT READY. NOT APPLIED TO PRODUCTION.**

## Files actually changed

- `docs/security-remediation/01_independent_acl.proposed.sql` — now the single consolidated deterministic SQL candidate: actual helper definitions, restrictive membership/category policies, table/column ACLs and independent product/reversal ACL postconditions.
- `docs/security-remediation/02_authorization_implementation_spec.md` — implemented rules, static caller compatibility and exact stopped dependencies.
- `docs/security-remediation/03_evidence_collection.readonly.sql` — preflight (sections 1–2) and post-candidate verification (section 3), including expected results; NOT EXECUTED.
- `docs/security-remediation/04_impact_and_approvals.md` — this consolidated report.
- `docs/task-1b-security/04_impact_compatibility_rollback_report.md` — successor pointer only; previous evidence preserved unchanged below it.
- `roadmap.md`, `AGENTS.md` — bounded implementation status/architecture rule.

No application code change was necessary for the verified active import call paths. No managed migration, import RPC, financial formula, quantity, cost, movement, receipt/order, reservation, UI, billing or auth-guard file was modified.

## Authorization before → proposed after

Before: caller-owned anchors and duplicate self-INSERT policies can supply approved/OWNER authority; raw anchors continue to authorize revoked users. Inventory's no-JWT DEFINER owner branch is unsafe. Reversal grants EXECUTE to anon.

After **the proposed subset, if separately validated/applied**: actual ownership or current approved membership governs three replaced helpers; anchors have no independent authority there. Restrictive AND gates constrain all duplicate permissive writes; identity/tenant UPDATE grants are removed. Nonowner OWNER grants are denied. Category tenant access additionally requires current membership. Anonymous product writes and reversal execution are revoked. Existing owner and protected admin branches are retained only where already present.

Unchanged unresolved paths still prevent complete authorization closure: canonical inventory no-JWT bypass, current-actor reversal authorization, onboarding, analytics, frozen context and elevated raw-anchor service readers. Nothing has changed in production.

## Acceptance evidence

PASS below means **local static implementation/scope only**, never an executed security test or production result.

| Criterion | Status | Evidence / limitation |
|---|---|---|
| No arbitrary self-created approved membership | PASS (local DDL); BLOCKED end-to-end | Restrictive INSERT requires self EMPLOYEE/pending or actual self-owner; trusted DEFINER writers/provenance still unresolved |
| No OWNER escalation via API membership tables | PASS (local DDL); BLOCKED system-wide | Actual-owner predicates and restricted UPDATE columns; nonowner existing OWNER precondition aborts rather than data repair |
| No stale anchor independent access | BLOCKED overall | Three helpers/category gate implemented; analytics/onboarding/context/service consumers not replaced |
| Legitimate owner/current approved access | PASS (static helper rules); BLOCKED runtime | Owner fallback survives atomic creation ordering; imported actor propagation unchanged; no tests run |
| Cross-business enforcement | BLOCKED overall | Replaced helpers and category gate check tenant; remaining consumers and RLS runtime not validated |
| Import confirm/correct compatibility | BLOCKED runtime/canonical replacement | Static calls use matching auth.uid/p_user_id; exact current inventory body/callers not proven; both import RPCs unchanged |
| Anonymous reversal EXECUTE denied | PASS (local SQL); BLOCKED runtime | REVOKE PUBLIC/anon plus effective privilege assertions; authenticated/service parity required |
| Inventory DEFINER trusts no unverified identity | BLOCKED | Unsafe live no-JWT branch explicitly not replaced; exact source and no-JWT callers absent |
| No financial/historical/reservation changes | PASS (scope) | DDL/ACL only; no executed DML or changed financial/reversal body |
| No production operations/tests/pushes | PASS | No Supabase tools, SQL, tests, builds, exploit probes, deploy or publish invoked |
| No local commit | BLOCKED environment constraint | Environment mandates committing request edits despite uploaded no-commit instruction; disclose actual commit in closing report |

## Preserved legitimate workflows

`src/App.tsx` actively routes import center/detail; receiving hook calls existing confirmation/correction. Their calls propagate authenticated caller and keep all arguments/provenance. Actual-owner business creation and own OWNER/approved legacy payload remain compatible with proposed predicates. Legacy create/join/onboarding pages are not registered in the active route tree; no invitation or employee-login feature is invented. The join form's job-title/role CHECK mismatch is a separate existing defect, not silently changed.

Existing permissive SELECT policies remain. Restrictive gates require an existing applicable permissive policy; they do not manufacture a new permission. Service-role SELECT/provisioning remains unchanged. Unknown trusted writers, inheritance and protected owner/admin write access require validation before application. Operational attribution employees remain independent from app login identities.

## Exact blockers, not another discovery task

1. Exact current inventory whole-body/default/ACL match and proven no-JWT caller boundaries; known import nested signed-in calls alone do not prove server compatibility.
2. Exact onboarding body and frozen-path implications; historical notification defaults include plan-limit settings.
3. Full stale-link closure in analytics, elevated exports/webhook readers and frozen business context; preserving an unverified service branch is not proof of authorization.
4. Authoritative existing approval provenance and protected businesses.owner_id/user_roles writers; supplied zero-stale counts do not prove legitimacy.
5. Actual RLS/JWT/tenant/import isolated execution checks and approved application/recovery window. Prepared read-only queries do not exercise real signed-in access.

No further production diagnostics were performed. The candidate is a reviewable implemented subset, NOT READY to apply. No automatic removal of gates, runtime writes, new employee workflow or trusted caller bypass is authorized.

## Recovery

Capture exact live policy/ACL/function baseline securely before separately approved application. Transaction exceptions must roll back proposed DDL; untested. Never restore arbitrary membership approval, anonymous write/EXECUTE grants or DEFINER-owner bypass automatically. Prefer reviewed forward-fix/read-only maintenance. No historical rollback or inventory data rewrite is supplied.

**NOT APPLIED TO PRODUCTION.**
