import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';
import { generateApiKey } from '../../lib/apiKeys.js';

// Optional catch-all: matches both /api/keys (list/create) and
// /api/keys/:id (revoke), merging what used to be keys/index.js +
// keys/[id].js into one Vercel function. External routes/behavior are
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
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const rawId = req.query.id;
  if (Array.isArray(rawId) && rawId.length > 1) {
    // e.g. /api/keys/a/b -- never matched any route before this merge.
    return res.status(404).json({ error: 'Not found' });
  }
  const id = resolveId(rawId);

  if (!id) {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to list API keys:', error);
        return res.status(500).json({ error: 'Failed to load API keys' });
      }
      return res.status(200).json({ keys: data });
    }

    if (req.method === 'POST') {
      const name = (req.body && req.body.name) || 'Default key';
      const { fullKey, prefix, hash } = generateApiKey();

      const { data, error } = await supabase
        .from('api_keys')
        .insert({ user_id: user.id, name, key_prefix: prefix, key_hash: hash })
        .select('id, name, key_prefix, created_at')
        .single();

      if (error) {
        console.error('Failed to create API key:', error);
        return res.status(500).json({ error: 'Failed to create API key' });
      }

      // fullKey is only ever returned here, at creation time -- only the hash
      // is persisted, so this is the caller's one chance to see it.
      return res.status(201).json({ key: { ...data, fullKey } });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to revoke API key:', error);
      return res.status(404).json({ error: 'API key not found' });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
