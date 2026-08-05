// Single source of truth for plan display copy -- used by both the public
// pricing section (components/home/PricingSection.jsx) and the
// authenticated Billing page (pages/AppShell.jsx). The actual Stripe Price
// used for checkout is selected server-side from the plan id
// (STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_FIRM); "free" never touches
// Stripe at all. This file only controls what's shown in the UI.
//
// TODO: confirm pricing -- tiers, prices, and feature lists below are
// placeholders until real pricing is finalized.
export const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Try LawScribe with no commitment.',
    features: ['3 documents / month', 'Access to core document types', 'Community support'],
    cta: 'Get Started',
    featured: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For solo practitioners and freelancers.',
    features: ['Unlimited documents', 'Full document type library', 'Client management', 'Priority email support'],
    cta: 'Sign Up',
    featured: true
  },
  {
    id: 'firm',
    name: 'Firm',
    price: '$99',
    period: '/mo',
    description: 'For small firms and teams.',
    features: ['Everything in Pro', 'Multiple team members', 'Shared client directory', 'Dedicated support'],
    cta: 'Sign Up',
    featured: false
  }
];
