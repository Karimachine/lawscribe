import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { generateApiKey } from '../lib/apiKeys.js';

// Flat file + query-string dispatch (?id=...), not a [[...id]].js optional
// catch-all -- Vercel's zero-config "Other" framework detection doesn't
// reliably register bracket-syntax dynamic API routes as real functions
// (confirmed: /api/clients, /api/documents, /api/keys, and /api/billing
// all 404'd at the platform level after the bracket-route consolidation).
// This still serves both /api/keys (list/create) and /api/keys?id=...
// (revoke) from one function -- req.query.id is undefined for the former,
// a plain string for the latter. The array-of-length->1 guard below now
// defends against a client sending ?id=a&id=b (repeated query params),
// not multi-segment paths, since that concept doesn't apply to a flat
// file.
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
    // e.g. ?id=a&id=b -- ambiguous, reject rather than guessing.
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
