import { useEffect, useState } from 'react';
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
  // The user's current active paid plan ('pro' | 'firm'), or null if
  // they're on Free, have no subscription, or aren't logged in -- drives
  // whether each button says "Sign Up", "Manage Subscription", or "Switch
  // to this plan" below.
  const [currentPlanId, setCurrentPlanId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentPlan = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session?.access_token) {
        if (isMounted) setCurrentPlanId(null);
        return;
      }

      const { data: subscription } = await supabase.from('subscriptions').select('plan, status').maybeSingle();
      if (!isMounted) return;

      const isActivePaidPlan =
        subscription &&
        (subscription.status === 'active' || subscription.status === 'trialing') &&
        (subscription.plan === 'pro' || subscription.plan === 'firm');

      setCurrentPlanId(isActivePaidPlan ? subscription.plan : null);
    };

    loadCurrentPlan();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadCurrentPlan();
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Used both when the user is switching from another paid plan and when
  // they click "Manage Subscription" on their current one -- either way,
  // this always routes to the Stripe Portal, never a new Checkout Session.
  const handleManageOrSwitch = async (planId) => {
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
      const response = await fetch('/api/billing?action=create-portal-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }

      const result = await response.json();
      if (!result.url) {
        throw new Error('No portal URL returned');
      }

      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to open billing portal', error);
      setCheckoutError('Unable to open the billing portal. Please try again.');
      setLoadingPlanId(null);
    }
  };

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
      const response = await fetch('/api/billing?action=create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ plan: planId })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The backend itself refuses to double-subscribe (see
        // client/api/billing/[action].js) -- this is a defensive fallback
        // for that same-plan case; the buttons below are designed so it
        // shouldn't normally be reachable, since the current plan's
        // button already reads "Manage Subscription" instead of "Sign Up".
        if (result.error === 'already_subscribed') {
          setCheckoutError(result.message || "You're already subscribed to this plan.");
        } else {
          throw new Error('Failed to create checkout session');
        }
        setLoadingPlanId(null);
        return;
      }

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
        {plans.map((plan) => {
          const isFree = plan.id === 'free';
          const isCurrentPlan = plan.id === currentPlanId;
          const isOtherActivePlan = currentPlanId && !isCurrentPlan;

          let label = plan.cta;
          let onClick = () => handlePaidSignup(plan.id);

          if (!isFree && isCurrentPlan) {
            label = 'Manage Subscription';
            onClick = () => handleManageOrSwitch(plan.id);
          } else if (!isFree && isOtherActivePlan) {
            label = 'Switch to this plan';
            onClick = () => handleManageOrSwitch(plan.id);
          }

          return (
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
              {isFree ? (
                <Link to="/login" className={`plan-btn ${plan.featured ? 'featured' : ''}`}>
                  {plan.cta}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`plan-btn ${plan.featured ? 'featured' : ''}`}
                  disabled={loadingPlanId === plan.id}
                  onClick={onClick}
                >
                  {loadingPlanId === plan.id ? 'Redirecting…' : label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PricingSection;
