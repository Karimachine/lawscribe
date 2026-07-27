import { Link } from 'react-router-dom';

// TODO: confirm pricing — tiers, prices, and feature lists below are
// placeholders until real pricing is finalized.
const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Try LawScribe with no commitment.',
    features: ['3 documents / month', 'Access to core document types', 'Community support'],
    cta: 'Get Started',
    featured: false
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For solo practitioners and freelancers.',
    features: ['Unlimited documents', 'Full document type library', 'Client management', 'Priority email support'],
    cta: 'Sign Up',
    featured: true
  },
  {
    name: 'Firm',
    price: '$99',
    period: '/mo',
    description: 'For small firms and teams.',
    features: ['Everything in Pro', 'Multiple team members', 'Shared client directory', 'Dedicated support'],
    cta: 'Sign Up',
    featured: false
  }
];

function PricingSection() {
  return (
    <section id="pricing" className="section">
      <div className="section-header">
        <span className="section-label">Pricing</span>
        <h2>Simple, transparent pricing</h2>
        <p className="section-sub">Choose the plan that fits how you work. Upgrade or cancel any time.</p>
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.name} className={`plan ${plan.featured ? 'featured' : ''}`}>
            {plan.featured && <span className="plan-badge">Most Popular</span>}
            <div className="plan-name">{plan.name}</div>
            <div className="plan-price">
              {plan.price}
              <span>{plan.period}</span>
            </div>
            <p className="plan-desc">{plan.description}</p>
            <div className="plan-divider" />
            {plan.features.map((feature) => (
              <p key={feature} className="plan-feature">
                {feature}
              </p>
            ))}
            <Link to="/login" className={`plan-btn ${plan.featured ? 'featured' : ''}`}>
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default PricingSection;
