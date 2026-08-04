import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

// Reached via Stripe Checkout's success_url. The webhook updates the
// subscriptions row asynchronously, so this page doesn't assume the
// subscription is active yet -- it just confirms checkout completed and
// sends the user back to Billing, which loads the current status itself.
function BillingSuccessPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          <h2>{t('billingSuccess_title')}</h2>
          <p>{t('billingSuccess_body')}</p>
          <div className="auth-actions">
            <button onClick={() => navigate('/app/billing')}>{t('billingSuccess_backToBilling')}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BillingSuccessPage;
