import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { plans } from '../../lib/plans';

// Key used to hand a chosen paid plan across the login/signup detour for
// logged-out visitors (see handlePaidSignup below) and picked back up in
// AppShell.jsx once a session actually exists. localStorage rather than
// react-router state because signUp() doesn't return a session when email
// confirmation is required -- the user may leave the SPA entirely (click a
// link in their inbox) and come back later, which in-memory route state
// wouldn't survive.
export const PENDING_CHECKOUT_PLAN_KEY = 'lawscribe_pending_checkout_plan';

function PricingSection() {
  const navigate = useNavigate();
  const [loadingPlanId, setLoadingPlanId] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  const handlePaidSignup = async (planId) => {
    setCheckoutError('');

    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    if (!session?.access_token) {
      localStorage.setItem(PENDING_CHECKOUT_PLAN_KEY, planId);
      navigate('/login');
      return;
    }

    setLoadingPlanId(planId);
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ plan: planId })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const result = await response.json();
      if (!result.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to start checkout', error);
      setCheckoutError('Unable to start checkout. Please try again.');
      setLoadingPlanId(null);
    }
  };

  return (
    <section id="pricing" className="section">
      <div className="section-header">
        <span className="section-label">Pricing</span>
        <h2>Simple, transparent pricing</h2>
        <p className="section-sub">Choose the plan that fits how you work. Upgrade or cancel any time.</p>
        {checkoutError && <p className="auth-error">{checkoutError}</p>}
      </div>

      <div className="pricing-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`plan ${plan.featured ? 'featured' : ''}`}>
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
            {plan.id === 'free' ? (
              <Link to="/login" className={`plan-btn ${plan.featured ? 'featured' : ''}`}>
                {plan.cta}
              </Link>
            ) : (
              <button
                type="button"
                className={`plan-btn ${plan.featured ? 'featured' : ''}`}
                disabled={loadingPlanId === plan.id}
                onClick={() => handlePaidSignup(plan.id)}
              >
                {loadingPlanId === plan.id ? 'Redirecting…' : plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default PricingSection;
