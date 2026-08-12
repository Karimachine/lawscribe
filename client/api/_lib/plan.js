// Shared "does this subscription unlock paid-tier features" check --
// requires an *active* paid plan, not merely a non-'free' plan value. A
// null/undefined plan (e.g. between Stripe customer creation and
// completed checkout) or a canceled/past_due paid subscription is treated
// as free-tier, same as an explicit plan: 'free'.
//
// Used by documents.js (free-tier document limit) and org.js (org-wide
// shared access, which is only ever as good as the org owner's current
// subscription status) -- pulled out here so both stay in sync rather than
// each carrying their own copy.
export function isActivePaidPlan(subscription) {
  return Boolean(
    subscription &&
      (subscription.status === 'active' || subscription.status === 'trialing') &&
      (subscription.plan === 'pro' || subscription.plan === 'firm')
  );
}
