# Task 1A — preparation only

- [x] Inspect repository schema, migration ordering, membership helpers, legacy writes and import dependencies.
- [x] Prepare additive SQL proposal outside the managed migration directory.
- [x] Prepare read-only preflight and verification SQL; do not execute either.
- [x] Document impact, authorization, compatibility, rollback and remaining blockers.
- [x] Statically review prepared deliverables; no tests, database execution or publishing.
- [ ] Apply migration — blocked pending explicit approval, refreshed preflight and compatibility/security validation.

# Security remediation — local only

- [x] Prepare independently safe anonymous product/reversal ACL proposal outside migration history.
- [x] Prepare current-membership and inventory-caller implementation specification with unresolved dependencies explicitly blocked.
- [x] Prepare read-only evidence queries and compatibility/approval report; do not execute SQL or runtime tests.
- [ ] Complete membership/inventory authorization replacement — blocked on exact live dependencies and verified trusted caller boundaries.
- [ ] Execute or validate against production — blocked pending separate approval; no deployment or publishing.