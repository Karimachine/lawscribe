import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getStripe } from '../_lib/stripe.js';

// Stripe signature verification needs the exact raw request bytes -- if
// Vercel's default JSON body parser runs first, the body it hands us has
// already been re-serialized and the signature check fails. Disabling it
// here (and only here) is required.
export const config = {
  api: {
    bodyParser: false
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Inverse of resolvePriceId() in create-checkout-session.js -- maps a
// Stripe Price ID back to the plan name stored in the subscriptions table.
function resolvePlanFromPriceId(priceId) {
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_FIRM) return 'firm';
  console.error('Stripe subscription price ID did not match any configured plan:', priceId);
  return null;
}

// Newer Stripe API versions moved current_period_end off the top-level
// Subscription object and onto each SubscriptionItem (each item can have
// its own billing period now). Check both locations so this works
// regardless of which API version the account is pinned to.
function resolveCurrentPeriodEnd(subscription) {
  return subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
}

// Converts a Stripe Unix-seconds timestamp to an ISO string. Stripe
// webhook handlers must not throw on a single malformed/missing field --
// a thrown error means Stripe treats the whole event as failed and
// retries it, delaying every other field in the same upsert too. Log and
// omit instead.
function unixSecondsToIso(value, context) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    console.warn(`Missing or invalid current_period_end for ${context}; leaving it unset.`, value);
    return null;
  }
  return new Date(value * 1000).toISOString();
}

export default async function handler(req, res) {
  const missingVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
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

  const stripe = getStripe();
  const supabase = getSupabaseAdmin();

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (!userId) {
          console.error('checkout.session.completed had no user_id reference:', session.id);
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const plan = resolvePlanFromPriceId(subscription.items.data[0]?.price?.id);

        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: subscription.id,
            plan,
            status: subscription.status,
            current_period_end: unixSecondsToIso(
              resolveCurrentPeriodEnd(subscription),
              `checkout.session.completed (subscription ${subscription.id})`
            ),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          console.error('Failed to upsert subscription on checkout.session.completed:', error);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const plan = resolvePlanFromPriceId(subscription.items.data[0]?.price?.id);

        const { error } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscription.id,
            plan,
            status: subscription.status,
            current_period_end: unixSecondsToIso(
              resolveCurrentPeriodEnd(subscription),
              `${event.type} (subscription ${subscription.id})`
            ),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false
          })
          .eq('stripe_customer_id', subscription.customer);

        if (error) {
          console.error(`Failed to update subscription on ${event.type}:`, error);
        }
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`Failed to process Stripe webhook event ${event.type}:`, error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
