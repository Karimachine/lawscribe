import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

// Landing spot after a successful account deletion, so the user gets a
// clear confirmation instead of just bouncing back to the login form.
function AccountDeletedPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          <h2>{t('accountDeleted_title')}</h2>
          <p>{t('accountDeleted_body')}</p>
          <div className="auth-actions">
            <button onClick={() => navigate('/')}>{t('accountDeleted_backHome')}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AccountDeletedPage;
