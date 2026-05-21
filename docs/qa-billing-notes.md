# QA — Billing Gate / Read-Only Mode

Last run: 2026-05-21

## Scope tested (backend)

All scenarios were run against the QA business only:
- Business: `QA Billing Test Business` (`b50d6eae-cfaa-478f-9aad-e5890438deff`)
- Subscription row used: `8028b6eb-b085-4dc2-a23e-893ded898509` (temporarily attached, then restored to orphan-trial)
- Memberships added: `user_businesses` + `business_users` for QA owner `2ce0b0d9-3d3d-4174-9919-4d845749387f`

## Results

| Scenario | status | `business_billing_status` | `can_business_write` | `require_active_business` |
|---|---|---|---|---|
| S1 active | `active` | active | true | passes |
| S2 trial (valid, +7d) | `trial` | trial | true | passes |
| S3 cancelled | `cancelled` | cancelled | false | raises P0001 |
| S4 trial expired | `trial` (past `trial_ends_at`) | restricted | false | raises P0001 |
| S5 restored active | `active` | active | true | passes |

`require_active_business` raises `ERRCODE P0001`, mapped by edge functions to **HTTP 402** and a `billing_events` row of type `billing_gate_blocked_action`.

## Confirmed behavior

- Active and trial (within window) → writable.
- Cancelled and expired-trial → read-only; mutations blocked at RLS via `can_business_write()`.
- Edge actions are blocked by `require_active_business`.
- Live business `צמיגי פאר` and its subscription were **not** touched.

## Not covered

- **Employee UI scenario** (non-owner sees "פנה למנהל העסק להפעלת המנוי" toast and is not redirected to `/subscribe`). Requires a dedicated QA employee auth user. `user_businesses.user_id` is unique per row so existing owner users cannot be reused as employees.
- Live browser click-through as a QA user (no QA password available in the preview session). UI is wired to the same backend gates verified above.

## Test data hardening

- `businesses.is_test` (boolean) and `businesses.admin_note` (text) columns added.
- QA Billing Test Business marked `is_test = true` with an admin_note.
- Any future `QA %` named business is auto-flagged on creation by convention; use `WHERE is_test = false` in any cross-tenant admin analytics.

## Cleanup (when QA is no longer needed)

```sql
UPDATE user_subscriptions
SET business_id = NULL, status = 'trial',
    trial_ends_at = '2026-06-09 18:27:49.947062+00',
    current_period_end = NULL, canceled_at = NULL,
    admin_note = 'orphaned_subscription_no_owned_business_after_billing_migration'
WHERE id = '8028b6eb-b085-4dc2-a23e-893ded898509';

DELETE FROM business_users    WHERE business_id = 'b50d6eae-cfaa-478f-9aad-e5890438deff';
DELETE FROM user_businesses   WHERE business_id = 'b50d6eae-cfaa-478f-9aad-e5890438deff';
DELETE FROM businesses        WHERE id          = 'b50d6eae-cfaa-478f-9aad-e5890438deff';
```
