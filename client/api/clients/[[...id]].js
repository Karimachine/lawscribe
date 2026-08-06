import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';
import { parsePagination } from '../_lib/pagination.js';

// Optional catch-all: matches both /api/clients (list/create) and
// /api/clients/:id (update/delete), merging what used to be clients.js +
// clients/[id].js into one Vercel function. External routes/behavior are
// unchanged -- req.query.id is undefined for the former, a one-element
// array for the latter.
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
    // e.g. /api/clients/a/b -- never matched any route before this merge.
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
