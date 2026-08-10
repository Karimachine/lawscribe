import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { parsePagination } from './_lib/pagination.js';

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

  const rawId = req.query.id;
  if (Array.isArray(rawId) && rawId.length > 1) {
    // e.g. ?id=a&id=b -- ambiguous, reject rather than guessing.
    return res.status(404).json({ error: 'Not found' });
  }
  const id = resolveId(rawId);

  if (!id) {
    if (req.method === 'GET') {
      const { page, limit, from, to } = parsePagination(req.query);

      const { data, error, count } = await supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

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

    const { data, error } = await supabase
      .from('clients')
      .update({
        name,
        email: email || null,
        phone: phone || null,
        case_type: case_type || null
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Supabase update error:', error);
      return res.status(404).json({ error: 'Client not found' });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

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
