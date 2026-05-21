
# QA Plan: Billing Read-Only Enforcement

Goal: verify Step 5–7 behavior across 5 scenarios without changing code. All changes are temporary SQL updates on `user_subscriptions` for one test business owner. Restore at the end.

## Preparation

1. Pick a test business and identify:
   - `business_id`
   - `owner_user_id` (the user whose `user_subscriptions` row drives `business_billing_status`)
   - One non-owner employee account in the same business (for scenario 5)
2. Record the current `status`, `trial_ends_at`, `current_period_end` of the owner's `user_subscriptions` row so we can restore it.
3. Log in to the preview as the **owner** in one browser, and as the **employee** in a second browser/incognito.

Helper SQL (read-only, run via Supabase read_query):
```sql
select us.user_id, us.status, us.trial_ends_at, us.current_period_end
from user_subscriptions us
where us.user_id = '<OWNER_USER_ID>';

select * from business_billing_status('<BUSINESS_ID>'::uuid);
select can_business_write('<BUSINESS_ID>'::uuid);
```

---

## Scenario 1 — `active` business (baseline)

Setup: ensure owner subscription `status='active'`, `current_period_end` in the future.

Expected:
- No amber billing banner on any page.
- `business_billing_status` returns `status=active`, `can_write=true`.
- Add Product, Edit Product, Delete Product, Add Supplier, Request Quotes, notifications toggles → all enabled, succeed.
- Edge Functions (e.g. `procurement-start-outreach`) return normal 200, no 402.

---

## Scenario 2 — `trial` business

Setup (migration):
```sql
update user_subscriptions
set status='trial', trial_ends_at = now() + interval '7 days'
where user_id='<OWNER_USER_ID>';
```

Expected: identical to Scenario 1. No banner, all writes work, no 402.

---

## Scenario 3 — `cancelled` / restricted business

Setup:
```sql
update user_subscriptions set status='cancelled'
where user_id='<OWNER_USER_ID>';
```

Owner browser, after reload:
- Amber `BillingReadOnlyBanner` visible at top of every authenticated page with Hebrew message + CTA to `/subscribe`.
- `useBusinessBillingStatus` → `isReadOnly=true`, `canWrite=false`.
- All gated buttons rendered via `BillingLockedButton` are dimmed; hover shows owner tooltip.
- Clicking "Add Product" / "Edit" / "Delete" / "Add Supplier" / "Request Quotes" / notification toggle / procurement actions:
  - No mutation fires.
  - Toast in Hebrew shown.
  - Owner is redirected (or offered link) to `/subscribe`.
- Direct Edge Function test via `supabase--curl_edge_functions` against `procurement-start-outreach`, `meta-send-message`, `log-stock-alert`, `procurement-backfill-low-stock` with this business's context → HTTP **402** with `"Subscription required for this business."`, and a row appended to `billing_events` with `event_type='billing_gate_blocked_action'`.
- Reads (Inventory list, Reports, Dashboard charts) still load normally.
- `/subscribe` is reachable and interactive.

Verification queries:
```sql
select event_type, created_at, payload
from billing_events
where business_id='<BUSINESS_ID>'
order by created_at desc limit 10;
```

---

## Scenario 4 — Restore to `active`

Setup:
```sql
update user_subscriptions
set status='active',
    current_period_end = now() + interval '30 days'
where user_id='<OWNER_USER_ID>';
```

Owner browser, after reload:
- Banner disappears.
- All previously-locked buttons return to normal styling and tooltips.
- Add/Edit/Delete/Request Quotes succeed end-to-end.
- Edge Functions return 200 again; no new `billing_gate_blocked_action` rows.

---

## Scenario 5 — Non-owner employee on restricted business

Setup: re-apply `status='cancelled'` from Scenario 3, then switch to the employee browser and reload.

Expected:
- Amber banner shown, but CTA reads "פנה למנהל העסק…" (no `/subscribe` link for employee).
- All write buttons dimmed; tooltip says contact the business manager.
- Clicking a gated action → Hebrew toast "פנה למנהל העסק להפעלת המנוי." No redirect to `/subscribe`.
- Reads work normally.
- Edge Functions called from employee session also return 402.

Final cleanup: restore the owner's original `status` / `trial_ends_at` / `current_period_end` recorded in Preparation.

---

## Notes / Safety

- All changes are SELECT + a couple of UPDATEs on `user_subscriptions` only. No schema or RLS changes.
- No external payment provider is contacted.
- Use Supabase migration tool for the UPDATEs (per project policy), or ask the user to run them manually if they prefer not to persist migrations for QA toggles.
- If `business_billing_status` RPC returns unexpected values, capture its raw output and the matching `user_subscriptions` row before changing anything else.
