import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';
import { getStripe } from '../_lib/stripe.js';

// Server-side plan -> price ID map. The client only ever sends a plan
// name ("pro"/"firm") -- never a price ID -- so there's no way to tamper
// with the request to check out at a cheaper price than the plan implies.
// "free" is deliberately absent: free signups never call this endpoint.
function resolvePriceId(plan) {
  if (plan === 'pro') return process.env.STRIPE_PRICE_ID_PRO;
  if (plan === 'firm') return process.env.STRIPE_PRICE_ID_FIRM;
  return null;
}

export default async function handler(req, res) {
  const missingVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID_PRO',
    'STRIPE_PRICE_ID_FIRM'
  ].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan } = req.body || {};
  const priceId = resolvePriceId(plan);
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan. Expected "pro" or "firm".' });
  }

  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;

      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to persist stripe_customer_id:', upsertError);
        return res.status(500).json({ error: 'Unable to start checkout' });
      }
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success`,
      cancel_url: `${origin}/billing/canceled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id }
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    return res.status(500).json({ error: 'Unable to start checkout' });
  }
}
