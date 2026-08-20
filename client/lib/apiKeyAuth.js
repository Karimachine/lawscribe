import { getSupabaseAdmin, getUserFromToken } from '../api/_lib/supabaseAdmin.js';
import { KEY_PREFIX, hashApiKey } from './apiKeys.js';

// Core lookup: given a raw credential string, resolve it to the api_keys
// row it belongs to (if valid and not revoked). Shared by both
// withApiKeyAuth below and resolveRequestIdentity, so the hash-lookup +
// revoked check + last_used_at touch exists in exactly one place.
async function lookupApiKey(supabase, rawKey) {
  const hash = hashApiKey(rawKey);
  const { data: keyRow, error } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !keyRow || keyRow.revoked_at) {
    return null;
  }

  // Best-effort, fire-and-forget -- a slow or failed touch must never
  // block or fail the actual request it's attached to.
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(
      () => {},
      (err) => console.error('Failed to update API key last_used_at:', err)
    );

  return keyRow;
}

// Wrap a Vercel function handler to authenticate via a LawScribe API key
// (Authorization: Bearer <key> or X-API-Key: <key>) instead of a Supabase
// session JWT. For routes that ONLY ever accept an API key -- nothing in
// this app is wired this way today (see resolveRequestIdentity below,
// used instead by /api/generate and /api/documents, both of which also
// need to accept a session JWT, or in generate's case no credential at
// all). Kept available for a future API-key-only route.
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

    const keyRow = await lookupApiKey(supabase, apiKey);
    if (!keyRow) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    req.apiUser = { id: keyRow.user_id };
    return handler(req, res);
  };
}

// Resolves the caller behind a request to ONE normalized identity shape
// regardless of which credential they used -- a Supabase session JWT
// (the browser app) or a LawScribe API key (lsk_live_..., programmatic
// access -- see keys.js for issuance). Used by routes that accept either
// credential type (and, for /api/generate, no credential at all).
//
// This exists so every plan/tier check downstream -- today's org-shared
// access, tomorrow's planned Free vs Pro document-type restriction,
// whatever comes after -- reads from the same resolved `user.id` no
// matter which credential produced it. A handler that keys its logic off
// this function's `user` can never be silently bypassed by calling it
// with an API key instead of a session, because there's only one code
// path either credential type funnels through.
//
// API keys are recognized by their fixed lsk_live_ prefix rather than a
// separate header, so both credential types share the one
// `Authorization: Bearer <token>` header callers already send (an
// X-API-Key header is also accepted, matching withApiKeyAuth above).
//
// Returns one of:
//   { authType: 'anonymous', user: null }                 -- no credential supplied
//   { authType: 'session',   user }                        -- valid session JWT
//   { authType: 'session',   user: null, error }           -- invalid/expired JWT
//   { authType: 'apiKey',    user, keyId }                 -- valid API key
//   { authType: 'apiKey',    user: null, error }           -- invalid/revoked key
export async function resolveRequestIdentity(supabase, req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const credential = bearer || req.headers['x-api-key'] || null;

  if (!credential) {
    return { authType: 'anonymous', user: null };
  }

  if (credential.startsWith(KEY_PREFIX)) {
    const keyRow = await lookupApiKey(supabase, credential);
    if (!keyRow) {
      return { authType: 'apiKey', user: null, error: 'Invalid or revoked API key' };
    }
    return { authType: 'apiKey', user: { id: keyRow.user_id }, keyId: keyRow.id };
  }

  const user = await getUserFromToken(supabase, header);
  if (!user) {
    return { authType: 'session', user: null, error: 'Unauthorized' };
  }
  return { authType: 'session', user };
}
