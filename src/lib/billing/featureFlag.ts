// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
//
// Global kill-switch for the trial→paid billing lock.
// When false, ALL client-side billing gates (SubscriptionGuard,
// BillingReadOnlyBanner, useRequireCanWriteAction) become no-ops and
// treat every business as active. Flip to true to re-enable enforcement.
export const BILLING_LOCK_ENABLED = false;

/**
 * FREE ACCESS MODE — temporary suspension of subscription enforcement.
 *
 * TRUE  → every authenticated user with legitimate business access may use
 *         Mlaiko regardless of subscription status, expired trial, cancelled
 *         plan or missing paid plan. No blocking "נדרש מנוי פעיל" screen.
 * FALSE → the original trial/paid enforcement resumes exactly as before.
 *
 * This is an APPLICATION-LEVEL POLICY ONLY. It bypasses subscription/payment
 * enforcement and nothing else. Authentication, business membership, tenant
 * isolation, roles/permissions, admin authorization and RLS are untouched and
 * still fully enforced. No subscription or payment record is modified.
 *
 * To restore paid enforcement: set BILLING_LOCK_ENABLED = true AND
 * FREE_ACCESS_MODE = false (plus the BILLING_LOCK_ENABLED='true' edge-function
 * secret). See docs/FREE_ACCESS_MODE.md.
 */
export const FREE_ACCESS_MODE = !BILLING_LOCK_ENABLED;
