// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
//
// Global kill-switch for the trial→paid billing lock.
// When false, ALL client-side billing gates (SubscriptionGuard,
// BillingReadOnlyBanner, useRequireCanWriteAction) become no-ops and
// treat every business as active. Flip to true to re-enable enforcement.
export const BILLING_LOCK_ENABLED = false;
