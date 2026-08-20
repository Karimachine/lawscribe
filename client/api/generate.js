import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { checkAndIncrementRateLimit, getClientIp } from './_lib/rateLimit.js';
import { resolveRequestIdentity } from '../lib/apiKeyAuth.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Authenticated (session OR API key): identified per-caller, generous
// limit for real iterative drafting or programmatic use. Same number for
// both -- an API key stands in for a real account here, not a lesser
// tier of it -- see the identity string below for why they still get
// separate buckets from each other.
const AUTHENTICATED_RATE_LIMIT = 20;
// Anonymous (the public homepage demo, see DemoGenerator.jsx): per-IP,
// matching client/src/lib/demoRateLimit.js's existing client-side cap
// exactly (3/hour) so the server-side limit reinforces, rather than
// contradicts, what the demo's own UI already promises the visitor.
const ANONYMOUS_RATE_LIMIT = 3;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY missing' });
  }

  // Now required unconditionally (previously only ANTHROPIC_API_KEY was
  // needed) -- rate limiting below needs Supabase regardless of whether
  // the caller turns out to be authenticated or anonymous.
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  const { prompt, documentType } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const supabase = getSupabaseAdmin();

  // Auth is optional here on purpose -- this route serves the
  // authenticated dashboard generator, programmatic callers using a
  // LawScribe API key (Authorization: Bearer lsk_live_..., see
  // client/lib/apiKeyAuth.js), AND the public, logged-out homepage demo
  // (DemoGenerator.jsx via generateDocument.js). No Authorization header
  // at all is a legitimate anonymous demo request, not an error. A
  // credential that IS present but fails to resolve -- an expired/invalid
  // session token, or an invalid/revoked API key -- is different in both
  // cases: that's a caller who believes they're authenticated going
  // stale/broken mid-use, not a demo visitor -- so it gets a proper 401
  // (the frontend reacts to the session case the same way as every other
  // authenticated write in this app, see handlePotentialSessionExpiry in
  // AppShell.jsx) rather than silently downgrading them to the anonymous
  // tier's much lower rate limit with no explanation.
  const auth = await resolveRequestIdentity(supabase, req);
  if (auth.authType !== 'anonymous' && !auth.user) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }
  const user = auth.user;

  // Org/plan status is deliberately NOT checked here. Unlike
  // documents.js/clients.js, this route never reads or writes a row that
  // has an org_id/user_id to scope -- it's a stateless Claude call. The
  // free-tier document *save* limit and org-shared *access* both already
  // apply correctly at the one place they actually mean something --
  // POST /api/documents -- so duplicating that check here would gate a
  // concept (org-shared access) that doesn't apply to this endpoint.
  // What generation actually needed was traceability + abuse throttling,
  // which the auth + rate limit above now provide.
  //
  // Note for whoever builds the planned Free vs Pro document-type
  // restriction: `user` above is resolved identically whether the caller
  // used a session or an API key (see resolveRequestIdentity), so a
  // documentType/plan check added here will automatically cover both --
  // no separate API-key case to remember.
  //
  // API keys get their own identity prefix (not `user:<id>`) so a caller
  // using both the app and a key don't share/starve one bucket, even
  // though the two currently carry the same numeric limit.
  const identity =
    auth.authType === 'apiKey' ? `apiKey:${user.id}` : user ? `user:${user.id}` : `ip:${getClientIp(req)}`;
  const maxRequests = user ? AUTHENTICATED_RATE_LIMIT : ANONYMOUS_RATE_LIMIT;

  const { limited } = await checkAndIncrementRateLimit(supabase, identity, maxRequests);
  if (limited) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({
      error: 'rate_limited',
      message: user
        ? "You're generating documents too quickly. Please wait a bit and try again."
        : "You've reached the demo limit for this hour. Sign up for unlimited access, or try again later."
    });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Write a complete ${documentType || 'legal'} document based on the request below. Return only the document text, with no preamble or commentary.\n\n${prompt}`
        }
      ]
    });

    const content = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // Minimal traceability -- addresses "no way to trace requests back to
    // a real user or org" from the report without building a full usage-
    // metering table (see the report's note on a possible future
    // per-plan monthly generation quota, which would want one).
    console.log(`Document generated by ${identity}`);

    return res.status(200).json({ content });
  } catch (error) {
    console.error('Error generating document:', error);
    return res.status(500).json({ error: 'Unable to generate document' });
  }
}
