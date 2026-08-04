// Display-only plan copy. The actual Stripe Price used for checkout is
// selected server-side (STRIPE_PRICE_ID env var) -- this only controls
// what's shown on the Billing page. Add more entries here if/when a second
// plan is introduced.
//
// Matches the "Pro" tier already advertised on the public pricing section
// (components/home/PricingSection.jsx) -- that page currently lists three
// placeholder tiers (Free/Pro/Firm) pending real pricing decisions, while
// only this one is actually wired up to Stripe so far.
export const plans = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For solo practitioners and freelancers.',
    features: ['Unlimited documents', 'Full document type library', 'Client management', 'Priority email support']
  }
];
