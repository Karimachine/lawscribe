import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

// Reached via Stripe Checkout's cancel_url when the user backs out before
// completing payment. No subscription was created -- nothing to reconcile.
function BillingCanceledPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          <h2>{t('billingCanceled_title')}</h2>
          <p>{t('billingCanceled_body')}</p>
          <div className="auth-actions">
            <button onClick={() => navigate('/app/billing')}>{t('billingCanceled_backToBilling')}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BillingCanceledPage;
