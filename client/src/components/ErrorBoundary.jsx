import { Component } from 'react';
import { usePreferences } from '../context/PreferencesContext';

// Hard navigation (not react-router's navigate) is intentional here: once
// getDerivedStateFromError flips hasError, this boundary never renders
// this.props.children again, so a client-side route change underneath it
// would be invisible. A full navigation forces a clean remount instead.
function ErrorFallback() {
  const { t } = usePreferences();

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          <h2>{t('errorBoundary_title')}</h2>
          <p>{t('errorBoundary_body')}</p>
          <div className="auth-actions">
            <button onClick={() => window.location.reload()}>{t('errorBoundary_reload')}</button>
            <button className="secondary" onClick={() => { window.location.href = '/app'; }}>
              {t('errorBoundary_goHome')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled error in app:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
