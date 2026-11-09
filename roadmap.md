# Task 1A — preparation only

- [x] Inspect repository schema, migration ordering, membership helpers, legacy writes and import dependencies.
- [x] Prepare additive SQL proposal outside the managed migration directory.
- [x] Prepare read-only preflight and verification SQL; do not execute either.
- [x] Document impact, authorization, compatibility, rollback and remaining blockers.
- [x] Statically review prepared deliverables; no tests, database execution or publishing.
- [ ] Apply migration — blocked pending explicit approval, refreshed preflight and compatibility/security validation.

# Security remediation — local bounded implementation

- [x] Implement explicit owner/current-approved membership helpers and restrictive membership/category gates in one existing local SQL candidate.
- [x] Consolidate independent ACL hardening and unexecuted preflight/verification expectations in the existing package.
- [x] Preserve verified active import call paths; no app/financial/reservation changes.
- [ ] Complete inventory/reversal actor and onboarding replacement — blocked on exact current source and proven caller/frozen-path compatibility.
- [ ] Close analytics/context/service-reader stale-link consumers — blocked on current contracts, protected authority evidence and freeze approval where applicable.
- [ ] Validate/apply — blocked on separately approved isolated checks, recovery and production execution; NOT READY, NOT APPLIED.

- [ ] V2 Employees screen — reference design received (Mlaiko_V2_Employee_Performance_Dashboard.png); later phase, not Phase 0
- [x] V2 Phase 0 — shared design + app shell behind flag (awaiting review)
