import { isActivePaidPlan } from './plan.js';

// Looks up the requesting user's org membership (if any) and whether that
// org currently grants shared access -- i.e. whether the org's owner has
// an active paid subscription right now. Membership/org rows are never
// deleted when the owner's subscription lapses (see
// provisionFirmOrgIfNeeded in billing/webhook.js) -- `active: false` here
// is what actually revokes shared access at query time, computed
// identically for every member including the owner themselves (an owner
// whose own subscription lapsed loses shared access exactly like anyone
// else in the org would).
//
// Returns null for a solo user with no org membership at all -- callers
// should fall back to plain user_id-scoped behavior in that case, same as
// before org support existed.
//
// Assumes one org per user: nothing in this app currently adds a user to
// a second org (team.js's add-member flow only checks membership within
// the org being added to), so .maybeSingle() below is intentional, not an
// oversight -- if multi-org membership is ever supported, this needs to
// become a list.
export async function getOrgAccessContext(supabase, userId) {
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    console.error('Failed to look up org membership:', membershipError);
    return null;
  }

  if (!membership) return null;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('owner_user_id')
    .eq('id', membership.org_id)
    .maybeSingle();

  if (orgError || !org) {
    console.error('Failed to look up organization for membership:', orgError);
    // Fail closed: an unresolvable org shouldn't silently grant shared
    // access. Membership/role are still returned so team.js (which
    // doesn't gate on subscription status) keeps working.
    return { orgId: membership.org_id, role: membership.role, active: false };
  }

  const { data: ownerSubscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', org.owner_user_id)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Failed to look up org owner's subscription:", subscriptionError);
    return { orgId: membership.org_id, role: membership.role, active: false };
  }

  return {
    orgId: membership.org_id,
    role: membership.role,
    active: isActivePaidPlan(ownerSubscription)
  };
}
