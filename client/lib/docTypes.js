// Canonical document-type list -- the single source of truth for both the
// frontend (client/src/lib/docTypes.js re-exports this unchanged, so every
// existing import site keeps working) and the backend (client/api/generate.js
// imports it directly to validate/gate documentType server-side). Lives here
// rather than under client/src/ because client/api/*.js functions can't
// reach into src/ -- this mirrors the existing client/lib/apiKeys.js pattern
// for code shared between the two.
//
// `tier` is the Free vs Pro/Firm split (2026-08-21 product decision):
// 'free' types are available on every plan; 'pro' types require an active
// paid plan (or org-shared Firm access) -- see isDocTypeUnlocked below and
// its use in generate.js. Free tier: NDA + Service Contract, matching the
// pre-existing public-demo subset (demoDocTypes below) -- a deliberate
// choice, not a coincidence: those two were already the "simplest/most
// universal" 2 shown to logged-out visitors.
export const docTypes = [
  {
    id: 0,
    label: 'NDA',
    title: 'Non-Disclosure Agreement',
    tier: 'free',
    prompt: 'Draft a mutual NDA between Acme Corp and a freelance designer named Sarah Chen. Include a 2-year confidentiality period and cover all design assets and client lists.'
  },
  {
    id: 1,
    label: 'SC',
    title: 'Service Contract',
    tier: 'free',
    prompt: 'Create a service contract for a web development project worth $8,000, with milestone payments, a 30-day revision period, and IP transfer upon final payment.'
  },
  {
    id: 2,
    label: 'LA',
    title: 'Lease Agreement',
    tier: 'pro',
    prompt: 'Generate a residential lease agreement for a 1BR apartment in Austin, TX at $1,650/month, 12-month term, no pets, utilities excluded.'
  },
  {
    id: 3,
    label: 'PP',
    title: 'Privacy Policy',
    tier: 'pro',
    prompt: 'Write a GDPR-compliant privacy policy for a SaaS product that collects email addresses and usage analytics. Include data retention and deletion rights.'
  },
  {
    id: 4,
    label: 'EO',
    title: 'Employment Offer',
    tier: 'pro',
    prompt: 'Draft an employment offer letter for a full-time marketing manager role, $75k salary, 15 days PTO, health benefits, and 90-day probation period.'
  },
  {
    id: 5,
    label: 'PA',
    title: 'Partnership Agreement',
    tier: 'pro',
    prompt: 'Create a 50/50 partnership agreement between two co-founders for a software startup, covering decision-making, profit sharing, and exit provisions.'
  }
];

// Subset shown in the public, no-login demo (kept small to control Claude API cost).
// Both entries are 'free' tier -- intentional, not incidental: nothing about
// the plan-gating logic assumes that, but it means the demo never has to
// deal with showing a locked type to a visitor who isn't even signed in yet.
export const demoDocTypes = docTypes.slice(0, 2);

// A document type is unlocked for a caller if it's a free-tier type, or the
// caller has full (Pro/Firm) access. Pulled out as a named function, not an
// inline comparison, so the frontend (grey out a locked button) and the
// backend (reject a locked type server-side) can't drift out of sync on
// what "locked" actually means if a third tier is ever added.
export function isDocTypeUnlocked(docType, hasFullAccess) {
  return docType?.tier === 'free' || Boolean(hasFullAccess);
}
