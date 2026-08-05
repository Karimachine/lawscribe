import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';

// Provisions the implicit Free tier -- no Stripe involved at all. Called
// once an authenticated session actually exists (see AppShell.jsx), rather
// than directly after signUp(), because signUp() doesn't hand back a
// session when email confirmation is required -- there'd be no token to
// authenticate this call with yet at that point.
//
// Idempotent and non-destructive: if a subscriptions row already exists
// (free, or a real paid plan from Stripe), this does nothing. It only ever
// creates the initial row, never overwrites an existing one.
export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: existing, error: existingError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) {
    console.error('Failed to check existing subscription:', existingError);
    return res.status(500).json({ error: 'Unable to set up account' });
  }

  if (existing) {
    return res.status(200).json({ ok: true });
  }

  const { error: insertError } = await supabase.from('subscriptions').insert({
    user_id: user.id,
    plan: 'free',
    status: 'active'
  });

  if (insertError) {
    console.error('Failed to create free subscription:', insertError);
    return res.status(500).json({ error: 'Unable to set up account' });
  }

  return res.status(201).json({ ok: true });
}
