import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';
import { getStripe } from '../_lib/stripe.js';

export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY'].filter(
    (name) => !process.env[name]
  );
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found for this user' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${origin}/app/billing`
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('Failed to create portal session:', error);
    return res.status(500).json({ error: 'Unable to open billing portal' });
  }
}
