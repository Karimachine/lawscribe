// Basic server-side rate limiter backed by Supabase (no new external
// service -- reuses the same Postgres database everything else in this
// app already relies on, rather than adding Vercel KV/Upstash for what's
// meant to be a "basic" safeguard). Fixed hourly windows, not a sliding
// window -- simple and adequate for blocking abuse, not built for
// split-second precision. The read-then-write below isn't atomic, so a
// concurrent burst right at a window boundary could let a handful of
// extra requests through -- an accepted trade-off for a basic limiter,
// not worth the complexity of a proper atomic increment (e.g. a Postgres
// function) here.
//
// Fails OPEN on any Supabase error: a rate-limiter outage must never be
// the reason a legitimate request gets blocked.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour, fixed window

function currentWindowStart() {
  return new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();
}

export async function checkAndIncrementRateLimit(supabase, identity, maxRequests) {
  const windowStart = currentWindowStart();

  try {
    const { data: existing, error: readError } = await supabase
      .from('generate_rate_limits')
      .select('request_count')
      .eq('identity', identity)
      .eq('window_start', windowStart)
      .maybeSingle();

    if (readError) throw readError;

    if (existing) {
      if (existing.request_count >= maxRequests) {
        return { limited: true };
      }
      const { error: updateError } = await supabase
        .from('generate_rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('identity', identity)
        .eq('window_start', windowStart);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('generate_rate_limits')
        .insert({ identity, window_start: windowStart, request_count: 1 });
      if (insertError) throw insertError;

      // Opportunistic cleanup, piggybacked on the (rarer) first-request-
      // in-a-new-window path rather than run on every call -- keeps the
      // table from growing unboundedly without needing a separate cron
      // job or pg_cron extension.
      const staleBefore = new Date(Date.now() - 24 * WINDOW_MS).toISOString();
      const { error: cleanupError } = await supabase
        .from('generate_rate_limits')
        .delete()
        .lt('window_start', staleBefore);
      if (cleanupError) {
        console.error('Failed to clean up stale rate limit rows:', cleanupError);
      }
    }

    return { limited: false };
  } catch (error) {
    console.error('Rate limit check failed, failing open:', error);
    return { limited: false };
  }
}

// Vercel's edge network populates x-forwarded-for with the real client IP
// (first entry, if there are multiple proxies in the chain) -- this is
// the only identity available for an unauthenticated request, and is
// exactly what client/src/lib/demoRateLimit.js's own TODO called for.
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
