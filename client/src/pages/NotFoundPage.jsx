import { useNavigate } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';

function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          <h2>{t('notFound_title')}</h2>
          <p>{t('notFound_body')}</p>
          <div className="auth-actions">
            <button onClick={() => navigate('/')}>{t('notFound_backHome')}</button>
            <button className="secondary" onClick={() => navigate('/app')}>
              {t('notFound_goToDashboard')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default NotFoundPage;
