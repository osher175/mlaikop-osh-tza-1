# Security remediation — local preparation

## Scope
Prepare the independently safe authorization changes locally, without changing production, application behavior, billing, login, business ownership or Task 1A. Do not introduce employee invitations, approval screens or reservation activation.

## Local deliverables
Create `docs/security-remediation/` containing:

1. **Proposed independent ACL migration:** remove effective anonymous/PUBLIC product write privileges at table and column levels; remove anonymous/PUBLIC execution of inventory reversal. Preserve authenticated and service-role privileges. Include fail-closed checks for inherited privileges and unexpected dependencies. Keep this SQL outside executable migration history.
2. **Blocked authorization implementation specification:** define owner/current-approved membership predicates, denial of self-assigned roles, and rejection of stale anchors. Document the required inventory caller replacement without deploying an unverified reconstructed function. No role-name, SECURITY DEFINER `current_user`, or client-setting bypass.
3. **Read-only evidence collection SQL:** exact current authorization functions, RLS policies, membership writers, ownership permissions, function contracts/ACLs and dependent consumers. Prepare but do not execute it.
4. **Impact and approval report:** exact changed files, approved-user retention, revoked-user denial requirements, inventory/import compatibility and remaining execution gates.

## Safe partial completion, not a security PASS
The previously inspected production definitions are not available as complete exact-source baselines in this checkout. Local migrations are historical evidence, not proof of the active production authorization graph.

Consequently, do not replace membership helpers or the inventory function, invent membership synchronization triggers, or claim revocation is fixed across all paths. Record these as blocked until separately authorized read-only production inspection establishes the complete dependencies and caller boundaries. The independent ACL proposal must be reviewable separately from these blocked changes.

Existing owners must retain access through verified `businesses.owner_id`. Existing legitimately approved users must retain their current permitted scope; an anchor alone is not approval evidence. Pending, rejected, revoked or missing approval must not authorize a nonowner through retained anchors. Role-sensitive import access must also require current authorized membership, without granting employee records authenticated privileges.

## Technical constraints
- No existing migration edits and no new files under `supabase/migrations/`.
- No production SQL, runtime tests, write probes, deployment, publishing or push commands.
- No changes to frozen files or `get_user_business_context`; any needed frozen-surface change requires its own explicit freeze approval.
- No stock, ledger, cost, PIN, import confirmation/correction/closure or RPC contract changes.
- Review the generated SQL and diff statically; runtime compatibility remains unverified.
- Update the roadmap with completed local work and named blockers. Save the requested local changes in a Git commit as required by this environment; this is not migration execution or publication.

## Stop point
Deliver the local proposals and factual blocker report. Full remediation remains **BLOCKED** until exact dependency evidence, trusted server execution boundaries, isolated validation and production execution receive separate approvals.