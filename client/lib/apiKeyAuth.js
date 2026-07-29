import { getSupabaseAdmin } from '../api/_lib/supabaseAdmin.js';
import { hashApiKey } from './apiKeys.js';

// Wrap a Vercel function handler to authenticate via a LawScribe API key
// (Authorization: Bearer <key> or X-API-Key: <key>) instead of a Supabase
// session JWT. Not wired to any route yet -- apply this to endpoints meant
// to be called with an api_keys-issued key rather than a logged-in session.
export function withApiKeyAuth(handler) {
  return async function (req, res) {
    const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
    if (missingVars.length > 0) {
      console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
      return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
    }

    const supabase = getSupabaseAdmin();

    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const apiKey = bearer || req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    const hash = hashApiKey(apiKey);
    const { data: keyRow, error } = await supabase
      .from('api_keys')
      .select('id, user_id, revoked_at')
      .eq('key_hash', hash)
      .single();

    if (error || !keyRow || keyRow.revoked_at) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id)
      .then(
        () => {},
        (err) => console.error('Failed to update last_used_at:', err)
      );

    req.apiUser = { id: keyRow.user_id };
    return handler(req, res);
  };
}
