import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';
import { getStripe } from '../_lib/stripe.js';

export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Guard against the FK violations this used to hit -- checked first,
  // before anything is touched, so a blocked deletion never leaves
  // partial state. Two separate chains end at this user/org:
  //   organizations.owner_user_id -> auth.users            (no ON DELETE)
  //   clients.org_id / documents.org_id -> organizations.id (no ON DELETE)
  // Both lack an ON DELETE clause (005_add_organizations.sql), so the
  // *order* deletions happen in matters. The org row itself is not
  // deleted here -- only after documents/clients are gone, further down
  // -- confirmed live: deleting organizations while a client/document
  // still references it via org_id fails with "violates foreign key
  // constraint ... on table clients", which is exactly what happened to
  // a sole owner who actually had org-linked content (the original fix's
  // test used synthetic accounts with none, so it never hit this).
  const { data: ownedOrg, error: ownedOrgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (ownedOrgError) {
    console.error('Failed to check organization ownership during account deletion:', ownedOrgError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  if (ownedOrg) {
    const { count: otherMembersCount, error: otherMembersError } = await supabase
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', ownedOrg.id)
      .neq('user_id', user.id);

    if (otherMembersError) {
      console.error('Failed to check org membership during account deletion:', otherMembersError);
      return res.status(500).json({ error: 'Unable to delete account' });
    }

    if ((otherMembersCount ?? 0) > 0) {
      return res.status(409).json({
        error: 'org_has_members',
        message: 'Remove all other team members before deleting your account.'
      });
    }
  }

  // Best-effort: cancel any live Stripe subscription so a deleted account
  // doesn't keep getting billed with no way left to manage it. Never blocks
  // account deletion -- if Stripe is unreachable or not configured, we log
  // and continue, since the subscriptions row is deleted below regardless.
  if (stripe) {
    const { data: subscriptionRow } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriptionRow?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscriptionRow.stripe_subscription_id);
      } catch (error) {
        console.error('Failed to cancel Stripe subscription during account deletion:', error);
      }
    }
  }

  const { error: subscriptionsError } = await supabase.from('subscriptions').delete().eq('user_id', user.id);
  if (subscriptionsError) {
    console.error('Failed to delete subscriptions during account deletion:', subscriptionsError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: documentsError } = await supabase.from('documents').delete().eq('user_id', user.id);
  if (documentsError) {
    console.error('Failed to delete documents during account deletion:', documentsError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: clientsError } = await supabase.from('clients').delete().eq('user_id', user.id);
  if (clientsError) {
    console.error('Failed to delete clients during account deletion:', clientsError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  // Sole owner (checked above; blocked already if other members exist) --
  // now safe to delete the org itself: this user's own documents/clients
  // that referenced it via org_id are gone (just above), which is what
  // the FK actually requires. But a *former* member (removed via
  // /api/team, not a current member) could still have their own
  // documents/clients pointing at this org_id -- their content was never
  // touched by that removal, only their organization_members row was.
  // Clearing (not deleting) any such leftover references detaches that
  // still-existing user's data from the org being deleted, rather than
  // destroying it as a side effect of someone else's account deletion --
  // same grandfathering principle as everywhere else in this app.
  if (ownedOrg) {
    const { error: clearDocOrgError } = await supabase
      .from('documents')
      .update({ org_id: null })
      .eq('org_id', ownedOrg.id);
    if (clearDocOrgError) {
      console.error('Failed to clear org_id on remaining documents during account deletion:', clearDocOrgError);
      return res.status(500).json({ error: 'Unable to delete account' });
    }

    const { error: clearClientOrgError } = await supabase
      .from('clients')
      .update({ org_id: null })
      .eq('org_id', ownedOrg.id);
    if (clearClientOrgError) {
      console.error('Failed to clear org_id on remaining clients during account deletion:', clearClientOrgError);
      return res.status(500).json({ error: 'Unable to delete account' });
    }

    // Cascades to remove the lone organization_members row too (org_id
    // references organizations(id) on delete cascade, see
    // 005_add_organizations.sql), so deleteUser() below no longer hits
    // the FK violation on organizations.owner_user_id either.
    const { error: deleteOrgError } = await supabase.from('organizations').delete().eq('id', ownedOrg.id);
    if (deleteOrgError) {
      console.error('Failed to delete organization during account deletion:', deleteOrgError);
      return res.status(500).json({ error: 'Unable to delete account' });
    }
  }

  const { error: keysError } = await supabase.from('api_keys').delete().eq('user_id', user.id);
  if (keysError) {
    console.error('Failed to delete API keys during account deletion:', keysError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error('Failed to delete auth user during account deletion:', deleteUserError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  return res.status(204).end();
}
