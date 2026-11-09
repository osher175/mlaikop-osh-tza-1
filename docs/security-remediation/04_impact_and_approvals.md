# Security remediation — local partial implementation report

**Decision: BLOCKED for complete authorization remediation. Independent ACL SQL prepared, not applied or runtime-validated.**

## Exact local files

- `docs/security-remediation/01_independent_acl.proposed.sql` — isolated transactional product/reversal ACL candidate.
- `docs/security-remediation/02_authorization_implementation_spec.md` — blocked membership/revocation/caller replacement specification.
- `docs/security-remediation/03_evidence_collection.readonly.sql` — unexecuted catalog and aggregate preflight/post-ACL queries.
- `docs/security-remediation/04_impact_and_approvals.md` — this report.
- `roadmap.md` — local completion and execution blockers.
- `AGENTS.md` — keep independent ACL proposals separate from blocked authorization replacements.
- `.lovable/plan/security-remediation-local-preparation-2026-11-09.md` — approved archived plan; platform removed the prior `.lovable/plan.md`.

No application, edge-function, existing migration or Task 1A file changes. No SQL queries, runtime tests, write probes, builds, production data changes, deployment, publishing or push commands executed. A local Git commit saves these proposals as required by the environment; it is not a production migration or deployment.

## What the independent SQL would do

Revoke PUBLIC/anon product INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER table privileges, plus INSERT/UPDATE/REFERENCES column grants. Revoke PUBLIC/anon reversal EXECUTE. Product SELECT is not revoked; existing RLS is unchanged. No global default ACL edits, membership changes, new grants or DML.

Before/after checks compare effective authenticated and service-role product privileges and reversal execution. If privileges inherited via PUBLIC would be lost, the transaction aborts rather than restoring broad grants. Inherited anon capabilities also abort. The reversal body is not replaced. An exclusive product-table lock is requested with a five-second timeout; a separately approved maintenance window is needed. This is a conditional review candidate, not approved production SQL. Other anonymous RPC write routes remain outside this ACL slice and must be inventoried before any system-wide denial claim.

## Approved users retain access — scope of claim

The ACL slice does not change membership rows, identifiers, RLS predicates, owner fields or role assignments. It is designed to preserve effective authenticated/service privileges exactly, or abort. Existing signed-in access therefore remains governed by the existing policies, including their unresolved defects. This is **not** evidence that current approvals were legitimate.

The blocked full implementation must preserve actual owner fallback and legitimate current approval, with the same existing role-sensitive scope. An operational sales-attribution employee is not an authenticated user. Duplicate/conflicting membership states and approval provenance require live evidence before implementing a predicate.

## Revoked users lose access — not yet implemented

They do **not** reliably lose access from this ACL proposal alone. Existing raw-anchor and helper paths may authorize retained `user_businesses` rows. No claim of revoked-user denial, owner-role hardening or completed membership security is made.

The required successor must consult current approval for every nonowner across active RLS, RPCs, views and service-side readers. Pending/rejected/revoked/missing approval must deny access despite retained anchors, including stale privileged roles. Existing rows must not be rewritten. Frozen `get_user_business_context` and protected ownership/admin writers are unresolved dependencies, not implicit permission to modify billing/login behavior.

## Inventory and import compatibility assessment

| Surface | Local action | Assessment |
|---|---|---|
| Canonical 19-argument inventory function | Unchanged | Historical source identifies unsafe no-JWT DEFINER-owner bypass; full replacement blocked on live body and trusted callers. |
| Quantity, cost, financial/provenance ledger | Unchanged | No stock/cost semantics or historical data altered. |
| Import confirmation/correction | Unchanged | Repository calls pass authenticated identity into canonical inventory; actual live dependency and runtime behavior unverified. |
| Import closure/landed costs/PIN | Unchanged | Contract/body not modified; transitive membership dependency still requires review. |
| Inventory reversal | EXECUTE ACL proposal only | Signed-in/service execution preserved or transaction aborts; original-user, owner and timing logic untouched. Existing operational bugs are not fixed. |
| Login/business ownership/billing/admin exceptions | Unchanged | No frozen files/functions edited; effects of a future membership replacement require separate freeze review. |
| Task 1A/reservations | Unchanged | Foundation proposal preserved; positive reservations not activated. |

Compatibility is a static assessment of proposed scope, **not a PASS or end-to-end verification**. Removing unsafe anonymous access is intentional. Product ACL and reversal postconditions do not prove complete caller authentication or role security.

## Remaining blockers and required approvals

1. **Live dependency evidence:** separately approve SELECT-only collection of exact active functions, policies, views, triggers, grants, ownership writers and membership consumers. Historical definitions and prior fingerprints are insufficient; no current production inspection occurred here.
2. **Current membership authority:** establish legitimate existing approvals, uniqueness/conflicting statuses, writer boundaries, actual owner provisioning and protected admin/ownership grants. No new invitation or employee approval system is required or included.
3. **Revocation closure:** enumerate and replace every helper/raw-anchor authorization path and service reader. Review frozen context separately if affected; no automatic frozen changes.
4. **Trusted inventory callers:** verify JWT-validating ingress, restricted SQL access, server/cron callers and explicit no-JWT execution boundary. No GUC/current_user/role-label bypass proposed.
5. **Exact source replacement:** capture canonical full definitions/contracts/ACLs; review exact old/new source and preserve inventory/import contracts before writing executable replacements.
6. **Isolated validation approval:** separately authorize identity, cross-business and import checks, including approved, pending, rejected, revoked, forged OWNER, stale anchor, conflicting status, mismatched actor and trusted server cases. No test scripts or runtime probes were run.
7. **Controlled production execution:** obtain backup/recovery evidence, a maintenance window, refreshed preflight and explicit migration approval. Deploy/publish remain prohibited.

## Prepared acceptance cases — not executed

- anon has no effective product table/column write capability or reversal EXECUTE; authenticated/service capabilities equal pre-change values.
- Actual owner and existing legitimate approved user retain only their authorized scope.
- Nonowner pending/rejected/revoked/missing membership is denied with and without a stale anchor; stale OWNER role cannot override current approval/role.
- Self-supplied OWNER/approved/business IDs do not create authority; tenant or user IDs cannot be moved through permissive write paths.
- Missing JWT, spoofed actor/GUC/role labels fail closed; approved trusted server boundary enforces tenant/actor authorization.
- Signed-in import confirmation/correction/closure retain quantities, financial/provenance ledger and return contracts; no duplicate application.
- Frozen billing/login and Task 1A remain untouched.

## Recovery

Capture exact ACLs and definitions securely before approved execution. Pre-COMMIT exceptions are intended to abort the transaction; this has not been exercised. After execution prefer a reviewed forward-fix or read-only maintenance. Do not automatically restore anonymous writes, arbitrary self-membership or the DEFINER-owner bypass. Never restore privileges with GRANT ALL. No unsafe rollback script or data rewrite is supplied.

**Stop point reached:** safe-partial local documents prepared; complete authorization remediation and production execution remain blocked on the approvals above.