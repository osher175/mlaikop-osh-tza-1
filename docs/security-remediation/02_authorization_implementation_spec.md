# Authorization implementation specification — BLOCKED, not executable

This is the blocked remainder of the approved safe-partial plan, not an implemented authorization fix. Do not deploy pseudocode or substitute historical migrations for exact live function source. No new employee invitation, approval or onboarding system is proposed.

## Current membership invariant

For a verified authenticated identity U and business B:

- Actual owner: `businesses.id = B AND businesses.owner_id = U`. Do not infer ownership from an anchor role or user-editable profile/metadata.
- Nonowner: a current, legitimately authorized `business_users` row for `(B,U)` with `status = 'approved'`. A `user_businesses` anchor alone never establishes authority. Determine exact uniqueness constraints and conflicting/duplicate status behavior from live evidence; ambiguous memberships must fail closed rather than let any approved row override a revoked row.
- Pending, rejected, revoked or missing membership denies a nonowner even while a stale anchor remains. Revocation must be consulted at authorization time; do not delete/backfill/reassign historical anchors as a substitute.
- Keep existing protected platform-admin exceptions only where already intentional, using protected `user_roles` and server checks. Do not add an admin bypass to paths that lack one.
- Preserve each path's existing role-sensitive permissions; being approved is not permission to manage imports or finances. Verify the canonical current membership role and allowed role vocabulary; a stale anchor cannot preserve a revoked management role.
- An operational employee selected for sales attribution is not an authenticated identity or membership grant. Do not create login users, PINs or privileged roles for these records.

## Prevent new self-authorization

Review all permissive and restrictive membership policies, grants, column privileges, triggers and SECURITY DEFINER writers together. Merely adding one restrictive-looking permissive policy leaves OR bypasses.

The intended change must prohibit self-assigned approved status, OWNER/management roles and arbitrary business anchors. Preserve verified actual-owner provisioning and existing approved records. Constrain identity/tenant fields against updates. Do not enable a new request or owner-approval API in this task. Exact existing permitted writes cannot be safely replaced until live owner-provisioning and membership writer definitions, protected ownership/role grants and caller ordering are captured.

No membership synchronization trigger is included: removing stale links would change data and still miss bypassing service readers. No user/business IDs or current membership rows are rewritten.

## Close every stale-link path

Prepare exact replacements for `is_business_member`, `is_active_business_actor` and `can_manage_business_imports` only after obtaining current definitions, contracts, ACLs and protected dependencies. Inventory ALL active raw-anchor policies, views, functions and service readers, including transitive/dynamic callers. Apply current membership checks to both USING and WITH CHECK where applicable. This is not satisfied by three helper replacements alone.

Known repository candidates include inventory/products, categories, suppliers, supplier invoices/preferences, import tables/storage/PIN, analytics, `user_has_business_access`, `is_first_user_in_business` and onboarding. Treat existence in historical SQL as a candidate, not active production proof.

`get_user_business_context` is frozen and feeds login/business selection and billing. No replacement is included. If it independently authorizes a stale link, remediation requires explicit freeze review and approval, not a silent contract change.

Service-reader candidates: `retail-iq-api` `/employees`, `procurement-request-webhook`, `procurement-quote-webhook`, `procurement-order-confirmed-webhook`. Their service client bypasses RLS; helper changes will not filter these reads. Confirm what each record means before replacing employee exports or notification recipients. None is changed here; deployment is forbidden and their full active contracts are not proven.

## Inventory caller authentication

Canonical function contract candidate: `execute_inventory_transaction(uuid,uuid,uuid,text,integer,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,uuid,text,text,text,uuid,jsonb)` returning JSONB. Confirm exact live argument names/defaults, owner, ACLs, search_path and body before replacement. Do not drop/recreate it or invent an overload.

Required signed-in path:

1. Establish that the request entered through JWT-validating Supabase/PostgREST and that SQL principals cannot impersonate request identities. `auth.uid()` is useful behind this boundary, not independent proof against arbitrary SQL clients setting request GUCs.
2. Bind the transaction actor to the verified caller, never to unchecked `p_user_id`; reject conflicting supplied identities using a reviewed compatibility rule. Preserve existing import callers that pass the same `auth.uid()`.
3. Require current membership/actual owner or an existing protected platform-admin exception for `p_business_id`, and retain the product/business match.
4. Missing identity fails closed unless a separately verified and approved trusted server path applies. Never trust SECURITY DEFINER `current_user`, a role-name setting, metadata, or a supplied actor/business UUID as proof.

Trusted server path is **unresolved**: capture actual no-JWT consumers (cron, SQL principals, edge functions, external callers), their grants, ingress validation and actor/tenant authorization. A valid service-role JWT is elevated server authority, not an employee identity. Do not put the key in the browser, use it as a caller token, add a broad bypass, or silently break legitimate server jobs. Define and approve a restricted entry boundary only after this inventory. No such path is implemented in this proposal.

## Exact replacement and compatibility requirements

Capture complete old source; review complete new source; enforce exact baseline and exact resulting source/contract/ACLs in the same controlled transaction. A fingerprint, substring match or local timestamp is insufficient. Preserve row locks, atomic ledger insertion, quantity rules, weighted cost, adjustments, financial fields, source/reference provenance and return values.

Keep import confirmation, correction, closure, PIN and landed-cost logic unchanged. Verify their transitive authorization and signed-in calls. Fresh isolated runtime validation needs separate approval; current work performs no runtime tests or probes.

**Status:** self-authorization and revocation are not fixed by the independent ACL proposal; complete membership and inventory replacement remains BLOCKED.