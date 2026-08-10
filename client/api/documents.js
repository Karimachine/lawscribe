import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { parsePagination } from './_lib/pagination.js';

// Flat file + query-string dispatch (?id=...), not a [[...id]].js optional
// catch-all -- Vercel's zero-config "Other" framework detection doesn't
// reliably register bracket-syntax dynamic API routes as real functions
// (confirmed: /api/clients, /api/documents, /api/keys, and /api/billing
// all 404'd at the platform level after the bracket-route consolidation).
// This still serves both /api/documents (list/create) and
// /api/documents?id=... (update/delete) from one function -- req.query.id
// is undefined for the former, a plain string for the latter. The
// array-of-length->1 guard below now defends against a client sending
// ?id=a&id=b (repeated query params), not multi-segment paths, since that
// concept doesn't apply to a flat file.
function resolveId(rawId) {
  if (Array.isArray(rawId)) {
    return rawId.length === 1 ? rawId[0] : null;
  }
  return rawId || null;
}

// Free tier gets 3 saved documents per calendar month (see plans.js's
// "3 documents / month" display copy -- that string is UI-only, not read
// programmatically, so keep this number in sync by hand if it ever
// changes). Enforced only here, at the point a document is actually
// persisted -- /api/generate (the Anthropic call) stays unrestricted,
// since it never writes a row.
const FREE_TIER_MONTHLY_DOCUMENT_LIMIT = 3;

// Mirrors the isActivePaidPlan check in PricingSection.jsx: unlimited
// documents require an *active* paid plan, not merely a non-'free' plan
// value. A null/undefined plan (e.g. between Stripe customer creation and
// completed checkout) or a canceled/past_due paid subscription is treated
// as free-tier-limited, same as an explicit plan: 'free'.
function isActivePaidPlan(subscription) {
  return Boolean(
    subscription &&
      (subscription.status === 'active' || subscription.status === 'trialing') &&
      (subscription.plan === 'pro' || subscription.plan === 'firm')
  );
}

// UTC calendar month boundary -- resets on the 1st, not a rolling 30 days.
// Simplest correct window: one comparison against a fixed boundary, no
// per-document math, and matches how "3 documents/month" reads on the
// pricing page.
function startOfCurrentUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
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
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Supabase fetch error:', error);
        return res.status(500).json({ error: 'Unable to fetch documents' });
      }

      return res.status(200).json({
        documents: data || [],
        total: count ?? 0,
        page,
        limit
      });
    }

    if (req.method === 'POST') {
      const { title, prompt, content } = req.body || {};
      if (!prompt || !content) {
        return res.status(400).json({ error: 'Prompt and content are required.' });
      }

      const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (subscriptionError) {
        console.error('Failed to check subscription for document limit:', subscriptionError);
        return res.status(500).json({ error: 'Unable to save document' });
      }

      if (!isActivePaidPlan(subscription)) {
        // Live count, not a stored counter -- a deleted document (hard
        // delete, no soft-delete column) simply no longer exists and no
        // longer counts. Accepted trade-off: this is a fair-use gate, not
        // an anti-abuse system, and needs no schema migration.
        const { count, error: countError } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfCurrentUtcMonth());

        if (countError) {
          console.error('Failed to count documents for free tier limit:', countError);
          return res.status(500).json({ error: 'Unable to save document' });
        }

        if ((count ?? 0) >= FREE_TIER_MONTHLY_DOCUMENT_LIMIT) {
          return res.status(403).json({
            error: 'free_tier_limit_reached',
            message: "You've used all 3 free documents this month.",
            upgradeUrl: '/app/billing'
          });
        }
      }

      const insert = {
        user_id: user.id,
        title: title || 'Generated Document',
        prompt,
        content
      };

      const { data, error } = await supabase.from('documents').insert([insert]).select().single();
      if (error) {
        console.error('Supabase insert error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return res.status(500).json({ error: 'Unable to save document' });
      }

      return res.status(201).json(data);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { title, prompt, content } = req.body || {};
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        title: title || 'Generated Document',
        prompt,
        content
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Supabase update error:', error);
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('documents')
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
      return res.status(500).json({ error: 'Unable to delete document' });
    }

    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
