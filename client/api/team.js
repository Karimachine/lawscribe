import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { getOrgAccessContext } from './_lib/org.js';

// Team management for Firm orgs (Phase 2 of team-member support; the
// GET response's org.active field is Phase 3.5, see below). Flat file,
// dispatched by HTTP method rather than a query-string id (there's no
// natural single resource id shared across GET/add/remove the way
// ?id=... works for clients.js/documents.js -- DELETE takes the target
// member's user_id in the body instead).
//
// GET is open to any member of an org (owner or not) so they can see
// their own team -- it deliberately does NOT gate on the org owner's
// subscription status the way clients.js/documents.js do (via
// getOrgAccessContext's `active` flag): seeing your own team roster isn't
// billing-gated, only the *document/client sharing* it unlocks is. POST
// (add) and DELETE (remove) are owner-only, checked directly against
// organization_members.role -- also not subscription-gated, so an owner
// can still manage their team while lapsed; the moment they resubscribe,
// shared data access resumes automatically (see org.js), no team-roster
// changes needed.
async function getRequesterMembership(supabase, userId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to look up organization membership:', error);
    return { membership: null, error };
  }
  return { membership: data, error: null };
}

export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  const supabase = getSupabaseAdmin();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { membership, error: membershipError } = await getRequesterMembership(supabase, user.id);
  if (membershipError) {
    return res.status(500).json({ error: 'Unable to look up team' });
  }

  if (req.method === 'GET') {
    if (!membership) {
      // Solo user, no org -- not an error, just nothing to show yet.
      return res.status(200).json({ org: null, members: [] });
    }

    const { data: rows, error } = await supabase
      .from('organization_members')
      .select('user_id, role, created_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to list org members:', error);
      return res.status(500).json({ error: 'Unable to list team members' });
    }

    // auth.users isn't exposed for a PostgREST embed/join, so email is
    // resolved per member via the admin API. Fine at real-world team
    // sizes (a handful of members); would need batching if that ever
    // changes.
    const members = await Promise.all(
      (rows || []).map(async (row) => {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(row.user_id);
        if (userError) {
          console.error(`Failed to look up email for member ${row.user_id}:`, userError);
        }
        return {
          user_id: row.user_id,
          role: row.role,
          created_at: row.created_at,
          email: userData?.user?.email || null
        };
      })
    );

    // Phase 3.5: expose whether shared data access is currently active,
    // via the exact same getOrgAccessContext already used (and tested) in
    // clients.js/documents.js -- reused verbatim rather than
    // reimplemented, so "active" means precisely the same thing
    // everywhere. This is a second membership lookup on top of
    // getRequesterMembership's own above (a small, deliberate redundancy
    // in exchange for reusing the tested helper as-is). GET /api/team
    // itself still isn't gated by it -- the roster is always visible
    // regardless -- only the response now also reports the flag, for the
    // frontend's paused-access banner.
    const orgAccessContext = await getOrgAccessContext(supabase, user.id);

    return res.status(200).json({
      org: { id: membership.org_id, active: orgAccessContext?.active === true },
      members
    });
  }

  if (req.method === 'POST') {
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the org owner can add team members' });
    }

    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // supabase-js's admin API has no "get user by email" call -- list and
    // filter client-side. perPage raised well past the current user base;
    // revisit with real pagination if this app ever needs it.
    const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      console.error('Failed to look up user by email:', listError);
      return res.status(500).json({ error: 'Unable to add team member' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetUser = userList?.users?.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);

    if (!targetUser) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'This person needs to create a LawScribe account first.'
      });
    }

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', membership.org_id)
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existingMembershipError) {
      console.error('Failed to check existing membership:', existingMembershipError);
      return res.status(500).json({ error: 'Unable to add team member' });
    }

    if (existingMembership) {
      return res.status(409).json({ error: 'already_member', message: 'This person is already on your team.' });
    }

    const { error: insertError } = await supabase
      .from('organization_members')
      .insert({ org_id: membership.org_id, user_id: targetUser.id, role: 'member' });

    if (insertError) {
      console.error('Failed to add team member:', insertError);
      return res.status(500).json({ error: 'Unable to add team member' });
    }

    return res.status(201).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only the org owner can remove team members' });
    }

    const { user_id: targetUserId } = req.body || {};
    if (!targetUserId) {
      return res.status(400).json({ error: 'user_id is required.' });
    }

    if (targetUserId === user.id) {
      // Removing the owner isn't supported in this phase -- that's
      // account-deletion's problem (client/api/account/delete.js), out of
      // scope here.
      return res.status(400).json({
        error: 'cannot_remove_owner',
        message: 'Removing yourself as the org owner is not supported yet.'
      });
    }

    const { error: deleteError, count } = await supabase
      .from('organization_members')
      .delete({ count: 'exact' })
      .eq('org_id', membership.org_id)
      .eq('user_id', targetUserId);

    if (deleteError) {
      console.error('Failed to remove team member:', deleteError);
      return res.status(500).json({ error: 'Unable to remove team member' });
    }

    if (!count) {
      return res.status(404).json({ error: 'Member not found in your org' });
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
