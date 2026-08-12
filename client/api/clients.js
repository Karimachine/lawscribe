import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { parsePagination } from './_lib/pagination.js';
import { getOrgAccessContext } from './_lib/org.js';

// Flat file + query-string dispatch (?id=...), not a [[...id]].js optional
// catch-all -- Vercel's zero-config "Other" framework detection doesn't
// reliably register bracket-syntax dynamic API routes as real functions
// (confirmed: /api/clients, /api/documents, /api/keys, and /api/billing
// all 404'd at the platform level after the bracket-route consolidation).
// This still serves both /api/clients (list/create) and
// /api/clients?id=... (update/delete) from one function -- req.query.id is
// undefined for the former, a plain string for the latter. The
// array-of-length->1 guard below now defends against a client sending
// ?id=a&id=b (repeated query params), not multi-segment paths, since that
// concept doesn't apply to a flat file.
function resolveId(rawId) {
  if (Array.isArray(rawId)) {
    return rawId.length === 1 ? rawId[0] : null;
  }
  return rawId || null;
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

  // Resolved once per request, reused across every branch below. See
  // documents.js for the identical pattern and reasoning.
  const orgContext = await getOrgAccessContext(supabase, user.id);
  const orgActive = orgContext?.active === true;

  const rawId = req.query.id;
  if (Array.isArray(rawId) && rawId.length > 1) {
    // e.g. ?id=a&id=b -- ambiguous, reject rather than guessing.
    return res.status(404).json({ error: 'Not found' });
  }
  const id = resolveId(rawId);

  if (!id) {
    if (req.method === 'GET') {
      const { page, limit, from, to } = parsePagination(req.query);

      // Org-active: any member sees every org client, not just their own.
      let clientsQuery = supabase.from('clients').select('*', { count: 'exact' });
      clientsQuery = orgActive ? clientsQuery.eq('org_id', orgContext.orgId) : clientsQuery.eq('user_id', user.id);

      const { data, error, count } = await clientsQuery.order('created_at', { ascending: false }).range(from, to);

      if (error) {
        console.error('Supabase fetch error:', error);
        return res.status(500).json({ error: 'Unable to fetch clients' });
      }

      return res.status(200).json({
        clients: data || [],
        total: count ?? 0,
        page,
        limit
      });
    }

    if (req.method === 'POST') {
      const { name, email, phone, case_type } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'Name is required.' });
      }

      const insert = {
        user_id: user.id,
        name,
        email: email || null,
        phone: phone || null,
        case_type: case_type || null
      };
      if (orgActive) {
        insert.org_id = orgContext.orgId;
      }

      const { data, error } = await supabase.from('clients').insert([insert]).select().single();
      if (error) {
        console.error('Supabase insert error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return res.status(500).json({ error: 'Unable to save client' });
      }

      return res.status(201).json(data);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { name, email, phone, case_type } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    // Org-active: any org member can update any org client. Otherwise
    // unchanged -- only the creator can.
    let updateQuery = supabase
      .from('clients')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        case_type: case_type || null
      })
      .eq('id', id);
    updateQuery = orgActive ? updateQuery.eq('org_id', orgContext.orgId) : updateQuery.eq('user_id', user.id);

    const { data, error } = await updateQuery.select().single();

    if (error || !data) {
      console.error('Supabase update error:', error);
      return res.status(404).json({ error: 'Client not found' });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    // Org-active: any org member can delete any org client. Otherwise
    // unchanged -- only the creator can.
    let deleteQuery = supabase.from('clients').delete().eq('id', id);
    deleteQuery = orgActive ? deleteQuery.eq('org_id', orgContext.orgId) : deleteQuery.eq('user_id', user.id);

    const { error } = await deleteQuery;

    if (error) {
      console.error('Supabase delete error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ error: 'Unable to delete client' });
    }

    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
