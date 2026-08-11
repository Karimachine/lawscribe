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

// Whether the subscription is scheduled to stop renewing. Depending on
// API version/flow, Stripe signals this two different ways:
// cancel_at_period_end (boolean) is the more commonly-documented signal,
// but some cancellations (confirmed via a real webhook payload on API
// version 2026-07-29.dahlia) instead report cancel_at_period_end: false
// while setting cancel_at to the specific timestamp it'll cancel at, plus
// cancellation_details.reason: "cancellation_requested". Checking
// cancel_at_period_end alone misses that case entirely -- treat either
// signal as "scheduled to cancel".
function isScheduledToCancel(subscription) {
  return Boolean(subscription.cancel_at_period_end) || subscription.cancel_at != null;
}

// Reverts a fully-terminated subscription back to the implicit Free tier.
// stripe_customer_id is deliberately left untouched -- if they resubscribe
// later, create-checkout-session reuses the same Stripe customer rather
// than creating a duplicate. current_period_end is cleared too (not just
// the three fields the plan reversion itself needs): leaving the old
// paid-plan's period-end sitting on a "free" row would make the Billing
// page show a stale "Renews on <date>" for a plan that never renews.
async function revertToFreePlan(supabase, subscription, context) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'active',
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      current_period_end: null
    })
    .eq('stripe_customer_id', subscription.customer);

  if (error) {
    console.error(`Failed to revert subscription to free plan on ${context}:`, error);
  }
}

// Narrower than the "unlimited documents" isActivePaidPlan check used
// elsewhere (documents.js) -- org provisioning is Firm-only, Pro doesn't
// get a team.
function isActiveFirmPlan(plan, status) {
  return plan === 'firm' && (status === 'active' || status === 'trialing');
}

// Phase 1 of team-member support: silently provisions a Firm owner's
// organization the same way the subscriptions row itself is silently
// provisioned -- no explicit setup step. Only creates; never
// demotes/deletes an org on downgrade or cancellation -- membership rows
// persist even if the owner drops back to Free, since revoking org-wide
// *access* on lapse is a query-level concern (Phase 2), not this table's
// existence.
//
// Idempotency: Stripe redelivers webhook events, so this must tolerate
// being called twice for the same user. The existence check below covers
// the normal case; the unique index on organizations.owner_user_id
// (005_add_organizations.sql) covers a genuine concurrent-delivery race by
// turning a second insert into a clean constraint violation (code 23505)
// instead of a duplicate row.
async function provisionFirmOrgIfNeeded(supabase, userId, plan, status, context) {
  if (!isActiveFirmPlan(plan, status)) return;

  try {
    const { data: existingOrg, error: existingOrgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (existingOrgError) {
      console.error(`Failed to check for existing org on ${context}:`, existingOrgError);
      return;
    }

    if (existingOrg) {
      // Already provisioned -- redelivered/duplicate event, no-op.
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      console.error(`Failed to look up user for org provisioning on ${context}:`, userError);
      return;
    }

    const { data: newOrg, error: insertOrgError } = await supabase
      .from('organizations')
      .insert({ name: `${userData.user.email}'s Firm`, owner_user_id: userId })
      .select('id')
      .single();

    if (insertOrgError) {
      if (insertOrgError.code === '23505') {
        console.warn(`Org already provisioned for user ${userId} (race on ${context}), skipping.`);
        return;
      }
      console.error(`Failed to create organization on ${context}:`, insertOrgError);
      return;
    }

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({ org_id: newOrg.id, user_id: userId, role: 'owner' });

    if (memberError) {
      console.error(`Failed to add owner membership on ${context}:`, memberError);
      return;
    }

    // Backfill: the owner's pre-existing clients/documents move into the
    // new org so they're visible to teammates once any get added
    // (Phase 2/3). Scoped to org_id is null so this never overwrites a
    // row that (in some future flow) already belongs to a different org.
    const { error: clientsBackfillError } = await supabase
      .from('clients')
      .update({ org_id: newOrg.id })
      .eq('user_id', userId)
      .is('org_id', null);

    if (clientsBackfillError) {
      console.error(`Failed to backfill org_id on clients on ${context}:`, clientsBackfillError);
    }

    const { error: documentsBackfillError } = await supabase
      .from('documents')
      .update({ org_id: newOrg.id })
      .eq('user_id', userId)
      .is('org_id', null);

    if (documentsBackfillError) {
      console.error(`Failed to backfill org_id on documents on ${context}:`, documentsBackfillError);
    }
  } catch (error) {
    // Org provisioning is best-effort and must never fail the webhook
    // itself -- the subscriptions write that already succeeded above must
    // not be retried (and re-applied) just because this step failed.
    console.error(`Unexpected error during org provisioning on ${context}:`, error);
  }
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
            cancel_at_period_end: isScheduledToCancel(subscription)
          },
          { onConflict: 'user_id' }
        );

        if (error) {
          console.error('Failed to upsert subscription on checkout.session.completed:', error);
        } else {
          await provisionFirmOrgIfNeeded(supabase, userId, plan, subscription.status, event.type);
        }
        break;
      }

      // customer.subscription.deleted is the event Stripe actually fires
      // when a subscription reaches full/final cancellation -- both for an
      // immediate cancellation and for one that was scheduled via
      // cancel_at_period_end and has now reached that date. It's a
      // separate event from .updated, not a status value .updated carries.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await revertToFreePlan(supabase, subscription, event.type);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;

        // Defensive: if a terminal 'canceled' status is ever reported via
        // .updated instead of a distinct .deleted event, handle it the
        // same way rather than writing a stale paid-plan row.
        if (subscription.status === 'canceled') {
          await revertToFreePlan(supabase, subscription, event.type);
          break;
        }

        const plan = resolvePlanFromPriceId(subscription.items.data[0]?.price?.id);

        const { data: updatedSubscription, error } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscription.id,
            plan,
            status: subscription.status,
            current_period_end: unixSecondsToIso(
              resolveCurrentPeriodEnd(subscription),
              `${event.type} (subscription ${subscription.id})`
            ),
            cancel_at_period_end: isScheduledToCancel(subscription)
          })
          .eq('stripe_customer_id', subscription.customer)
          .select('user_id')
          .maybeSingle();

        if (error) {
          console.error(`Failed to update subscription on ${event.type}:`, error);
        } else if (updatedSubscription?.user_id) {
          // Unlike checkout.session.completed, this event only carries the
          // Stripe customer id, not our user_id -- read it back off the row
          // the update above just matched via stripe_customer_id.
          await provisionFirmOrgIfNeeded(supabase, updatedSubscription.user_id, plan, subscription.status, event.type);
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
