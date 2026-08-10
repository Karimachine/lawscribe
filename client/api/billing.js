import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { getStripe } from './_lib/stripe.js';

// Server-side plan -> price ID map. The client only ever sends a plan
// name ("pro"/"firm") -- never a price ID -- so there's no way to tamper
// with the request to check out at a cheaper price than the plan implies.
// "free" is deliberately absent: free signups never call this endpoint.
function resolvePriceId(plan) {
  if (plan === 'pro') return process.env.STRIPE_PRICE_ID_PRO;
  if (plan === 'firm') return process.env.STRIPE_PRICE_ID_FIRM;
  return null;
}

// Guards against creating a second Stripe subscription for a user who
// already has an active one -- see the hasActivePaidPlan check below.
async function handleCreateCheckoutSession(req, res, { supabase, stripe, user }) {
  const missingVars = ['STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID_FIRM'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  const { plan } = req.body || {};
  const priceId = resolvePriceId(plan);
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan. Expected "pro" or "firm".' });
  }

  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, plan, status')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasActivePaidPlan =
      existing &&
      (existing.status === 'active' || existing.status === 'trialing') &&
      (existing.plan === 'pro' || existing.plan === 'firm');

    if (hasActivePaidPlan) {
      // Never create a second Stripe subscription for a customer who
      // already has one -- that's what let one test account end up with
      // three simultaneous active subscriptions. Same plan: tell the user
      // rather than re-checking out. Different plan: tier switching is
      // Stripe Portal's job, not a new Checkout Session.
      if (existing.plan === plan) {
        return res.status(409).json({
          error: 'already_subscribed',
          message: "You're already subscribed to this plan."
        });
      }

      if (!existing.stripe_customer_id) {
        // Shouldn't happen -- an active paid plan implies a Stripe
        // customer exists -- but fail safely instead of risking a
        // duplicate subscription.
        console.error('Active paid plan with no stripe_customer_id for user:', user.id);
        return res.status(409).json({
          error: 'already_subscribed',
          message: 'You already have an active subscription. Please contact support to change plans.'
        });
      }

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: existing.stripe_customer_id,
        return_url: `${origin}/app/billing`
      });

      return res.status(200).json({ url: portalSession.url });
    }

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

async function handleCreatePortalSession(req, res, { supabase, stripe, user }) {
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

async function handleCreateFreeSubscription(req, res, { supabase, user }) {
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

// Flat file + query-string dispatch (?action=...), not a [action].js
// dynamic-segment route -- Vercel's zero-config "Other" framework
// detection doesn't reliably register bracket-syntax dynamic API routes as
// real functions (confirmed: /api/clients, /api/documents, /api/keys, and
// /api/billing all 404'd at the platform level after the bracket-route
// consolidation). This one file still replaces what used to be
// create-checkout-session.js, create-portal-session.js, and
// create-free-subscription.js -- req.query.action now comes from an actual
// ?action=... query string instead of a path segment, but the dispatch
// logic itself is unchanged. webhook.js is deliberately NOT merged in: it
// needs the raw request body disabled for signature verification (see
// webhook.js), which would break JSON parsing for these three POST
// actions if they shared one file.
const ACTIONS = {
  'create-checkout-session': handleCreateCheckoutSession,
  'create-portal-session': handleCreatePortalSession,
  'create-free-subscription': handleCreateFreeSubscription
};

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

  const { action } = req.query;
  const handlerFn = ACTIONS[action];
  if (!handlerFn) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Stripe config is only required for the two actions that actually call
  // Stripe -- create-free-subscription must keep working even before
  // Stripe env vars are set, since the Free tier never touches Stripe.
  if (action !== 'create-free-subscription') {
    const missingStripeVars = ['STRIPE_SECRET_KEY'].filter((name) => !process.env[name]);
    if (missingStripeVars.length > 0) {
      console.error(`Missing required environment variable(s): ${missingStripeVars.join(', ')}`);
      return res.status(500).json({ error: `Server misconfigured: missing ${missingStripeVars.join(', ')}` });
    }
  }

  const supabase = getSupabaseAdmin();
  const stripe = getStripe();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return handlerFn(req, res, { supabase, stripe, user });
}
