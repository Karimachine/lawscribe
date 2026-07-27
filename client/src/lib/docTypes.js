export const docTypes = [
  {
    id: 0,
    label: 'NDA',
    title: 'Non-Disclosure Agreement',
    prompt: 'Draft a mutual NDA between Acme Corp and a freelance designer named Sarah Chen. Include a 2-year confidentiality period and cover all design assets and client lists.'
  },
  {
    id: 1,
    label: 'SC',
    title: 'Service Contract',
    prompt: 'Create a service contract for a web development project worth $8,000, with milestone payments, a 30-day revision period, and IP transfer upon final payment.'
  },
  {
    id: 2,
    label: 'LA',
    title: 'Lease Agreement',
    prompt: 'Generate a residential lease agreement for a 1BR apartment in Austin, TX at $1,650/month, 12-month term, no pets, utilities excluded.'
  },
  {
    id: 3,
    label: 'PP',
    title: 'Privacy Policy',
    prompt: 'Write a GDPR-compliant privacy policy for a SaaS product that collects email addresses and usage analytics. Include data retention and deletion rights.'
  },
  {
    id: 4,
    label: 'EO',
    title: 'Employment Offer',
    prompt: 'Draft an employment offer letter for a full-time marketing manager role, $75k salary, 15 days PTO, health benefits, and 90-day probation period.'
  },
  {
    id: 5,
    label: 'PA',
    title: 'Partnership Agreement',
    prompt: 'Create a 50/50 partnership agreement between two co-founders for a software startup, covering decision-making, profit sharing, and exit provisions.'
  }
];

// Subset shown in the public, no-login demo (kept small to control Claude API cost).
export const demoDocTypes = docTypes.slice(0, 2);
