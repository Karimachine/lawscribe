import Stripe from 'stripe';

let cachedClient;

export function getStripe() {
  if (cachedClient !== undefined) return cachedClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  cachedClient = secretKey ? new Stripe(secretKey) : null;
  return cachedClient;
}
