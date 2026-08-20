import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { parsePagination } from './_lib/pagination.js';
import { isActivePaidPlan } from './_lib/plan.js';
import { getOrgAccessContext } from './_lib/org.js';
import { renderDocumentPdf, sanitizeFilename } from './_lib/documentPdf.js';
import { resolveRequestIdentity } from '../lib/apiKeyAuth.js';

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

  // Accepts either a Supabase session JWT or a LawScribe API key
  // (Authorization: Bearer lsk_live_..., see client/lib/apiKeyAuth.js) --
  // unlike /api/generate, an anonymous request is never valid here.
  const auth = await resolveRequestIdentity(supabase, req);
  if (!auth.user) {
    return res.status(401).json({ error: auth.error || 'Unauthorized' });
  }
  const user = auth.user;

  // API keys are scoped to read-only document access -- they can list
  // and fetch, matching what a "generate + retrieve programmatically"
  // workflow needs, but creating, editing, or deleting a document still
  // requires a real session. Checked before the org lookup below so a
  // request that's about to be rejected doesn't pay for one first.
  if (auth.authType === 'apiKey' && req.method !== 'GET') {
    return res.status(403).json({
      error: 'api_key_read_only',
      message: 'API keys can only read documents. Use the LawScribe app to create, edit, or delete documents.'
    });
  }

  // Resolved once per request, reused across every branch below. null for
  // a solo user (no org); `active: false` for an org member whose org
  // owner's subscription has lapsed -- either way, orgActive being false
  // means "fall back to plain user_id-scoped behavior", identical to how
  // this route worked before team support existed.
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

      // Org-active: any member sees every org document, not just their
      // own. Otherwise unchanged -- scoped to the requester's own rows.
      let documentsQuery = supabase.from('documents').select('*', { count: 'exact' });
      documentsQuery = orgActive
        ? documentsQuery.eq('org_id', orgContext.orgId)
        : documentsQuery.eq('user_id', user.id);

      const { data, error, count } = await documentsQuery.order('created_at', { ascending: false }).range(from, to);

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

      // An active org shares its owner's unlimited-document status --
      // orgs are only ever provisioned for an active Firm subscription
      // (webhook.js), and Firm is unlimited regardless of who on the team
      // is saving. Skip the individual subscription/count check entirely
      // in that case: checking the *requesting* member's own subscription
      // would be wrong here, since a non-owner member typically has no
      // subscription row of their own at all and would otherwise be
      // incorrectly treated as free-tier-limited.
      if (!orgActive) {
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
      }

      const insert = {
        user_id: user.id,
        title: title || 'Generated Document',
        prompt,
        content
      };
      // org_id stays null (default, same as before team support) unless
      // the requester belongs to a currently-active org.
      if (orgActive) {
        insert.org_id = orgContext.orgId;
      }

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

  if (req.method === 'GET') {
    // Single-document fetch by id -- didn't exist before this route only
    // ever served the list (?page=/?limit=) and PUT/PATCH/DELETE by id.
    // Added specifically to back the PDF download below, but useful on
    // its own (e.g. a direct link to one document) since the frontend
    // otherwise always finds a document by scanning its already-loaded
    // list in memory.
    //
    // Org-active: any org member can view/download any org document, not
    // just its creator -- same access shape as every other branch here.
    let singleQuery = supabase.from('documents').select('*').eq('id', id);
    singleQuery = orgActive ? singleQuery.eq('org_id', orgContext.orgId) : singleQuery.eq('user_id', user.id);

    const { data, error } = await singleQuery.maybeSingle();

    if (error) {
      console.error('Supabase fetch error (single document):', error);
      return res.status(500).json({ error: 'Unable to fetch document' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Minimal v1 of document version history: no restore UI yet (see
    // TODO.md), just enough to confirm capture is working and to give a
    // future UI something to build on. Timestamps + who edited only --
    // never the snapshot content itself, so this stays cheap regardless
    // of how much history a document accumulates. Access is governed by
    // the same document-level check just above (org-aware `data` fetch)
    // -- if you can view the document, you can view its version list.
    if (req.query.versions === 'true') {
      const { data: versions, error: versionsError } = await supabase
        .from('document_versions')
        .select('id, created_at, edited_by')
        .eq('document_id', id)
        .order('created_at', { ascending: false });

      if (versionsError) {
        console.error('Failed to fetch document versions:', versionsError);
        return res.status(500).json({ error: 'Unable to fetch document versions' });
      }

      return res.status(200).json({ versions });
    }

    if (req.query.format === 'pdf') {
      try {
        const pdfBuffer = await renderDocumentPdf(data);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(data.title)}.pdf"`);
        return res.status(200).send(pdfBuffer);
      } catch (pdfError) {
        console.error('Failed to generate PDF:', pdfError);
        return res.status(500).json({ error: 'Unable to generate PDF' });
      }
    }

    return res.status(200).json(data);
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { title, prompt, content } = req.body || {};
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }
    const newTitle = title || 'Generated Document';

    // Read the current (about-to-be-overwritten) state first -- same
    // org-aware scoping as the update below, so this can't be used to
    // probe a document's existence/content without access. This is what
    // gets snapshotted into document_versions just below, since the
    // UPDATE's own .select() only ever returns the NEW row -- the old
    // content is gone the moment it runs unless captured beforehand.
    let currentQuery = supabase.from('documents').select('title, prompt, content').eq('id', id);
    currentQuery = orgActive ? currentQuery.eq('org_id', orgContext.orgId) : currentQuery.eq('user_id', user.id);
    const { data: current, error: currentError } = await currentQuery.maybeSingle();

    if (currentError) {
      console.error('Supabase fetch error (pre-update snapshot read):', currentError);
      return res.status(500).json({ error: 'Unable to update document' });
    }
    if (!current) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // No-op save (identical title/prompt/content) skips the snapshot --
    // nothing was actually lost, so there's nothing worth keeping a
    // history row for (e.g. clicking "Update Document" without changing
    // anything).
    const isNoOpSave = current.title === newTitle && current.prompt === prompt && current.content === content;

    if (!isNoOpSave) {
      // Not wrapped in a transaction with the update below (the Supabase
      // JS client has no simple multi-statement transaction here) -- if
      // this insert succeeds but the update after it fails, the result is
      // one redundant version row that's identical to the still-unchanged
      // current document, not lost or corrupted data. Accepted trade-off
      // for a v1, same "basic, not atomic" reasoning already used for the
      // rate limiter in _lib/rateLimit.js.
      const { error: versionError } = await supabase.from('document_versions').insert({
        document_id: id,
        title: current.title,
        prompt: current.prompt,
        content: current.content,
        // Always a real session user here, never an API key -- the
        // api_key_read_only check above already rejects API-key callers
        // before any write branch is reached.
        edited_by: user.id
      });
      if (versionError) {
        console.error('Failed to snapshot document version:', versionError);
        return res.status(500).json({ error: 'Unable to update document' });
      }
    }

    // Org-active: any org member can update any org document, not just
    // its creator. Otherwise unchanged -- only the creator can.
    let updateQuery = supabase
      .from('documents')
      .update({
        title: newTitle,
        prompt,
        content
      })
      .eq('id', id);
    updateQuery = orgActive ? updateQuery.eq('org_id', orgContext.orgId) : updateQuery.eq('user_id', user.id);

    const { data, error } = await updateQuery.select().single();

    if (error || !data) {
      console.error('Supabase update error:', error);
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    // Org-active: any org member can delete any org document. Otherwise
    // unchanged -- only the creator can.
    let deleteQuery = supabase.from('documents').delete().eq('id', id);
    deleteQuery = orgActive ? deleteQuery.eq('org_id', orgContext.orgId) : deleteQuery.eq('user_id', user.id);

    const { error } = await deleteQuery;

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

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
