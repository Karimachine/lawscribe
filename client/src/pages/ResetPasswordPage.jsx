import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { usePreferences } from '../context/PreferencesContext';
import PasswordInput from '../components/shared/PasswordInput';
import { validatePassword, formatPasswordErrors } from '../lib/passwordValidation';

// Reached via the redirectTo link in the password-reset email. Supabase's
// client processes the recovery token from the URL fragment on load and
// fires a PASSWORD_RECOVERY auth event; we only show the form once that's
// confirmed, rather than trusting the URL alone.
function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // The PASSWORD_RECOVERY event can fire before this listener attaches,
    // so also check for an already-established session as a fallback --
    // either signal is treated as a valid landing.
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data?.session) {
        setReady(true);
      }
      setChecking(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(timeout);
  }, [success, navigate]);

  const handleSubmit = async () => {
    setValidationError('');
    setSubmitError('');

    // Checked on `password` first; `confirmPassword` is validated by the
    // equality check below rather than re-running the same rule against it
    // -- once the two match, whatever passed for `password` passed for
    // `confirmPassword` too.
    const { valid, errors } = validatePassword(password, t);
    if (!valid) {
      setValidationError(formatPasswordErrors(errors, t));
      return;
    }

    if (password !== confirmPassword) {
      setValidationError(t('reset_passwordsDontMatch'));
      return;
    }

    setSubmitLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
    } catch (error) {
      console.error('Failed to update password', error);
      setSubmitError(error?.message || t('reset_updateErrorGeneric'));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <section className="auth-section">
        <div className="auth-panel">
          {checking ? (
            <p>{t('reset_checkingLink')}</p>
          ) : success ? (
            <>
              <h2>{t('reset_successTitle')}</h2>
              <p>{t('reset_successBody')}</p>
              <div className="auth-actions">
                <button onClick={() => navigate('/login')}>{t('reset_continueToLogin')}</button>
              </div>
            </>
          ) : !ready ? (
            <>
              <h2>{t('reset_invalidTitle')}</h2>
              <p>{t('reset_invalidBody')}</p>
              <div className="auth-actions">
                <button onClick={() => navigate('/login')}>{t('reset_backToLogin')}</button>
              </div>
            </>
          ) : (
            <>
              <h2>{t('reset_title')}</h2>
              <label>{t('reset_newPassword')}</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="field-hint">{t('reset_passwordHint')}</p>
              <label>{t('reset_confirmPassword')}</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {validationError && <p className="auth-error">{validationError}</p>}
              {submitError && (
                <p className="auth-error">
                  {submitError}{' '}
                  <button type="button" className="link-button" onClick={() => navigate('/login')}>
                    {t('reset_requestNewLink')}
                  </button>
                </p>
              )}
              <div className="auth-actions">
                <button disabled={submitLoading} onClick={handleSubmit}>
                  {submitLoading ? t('reset_updating') : t('reset_updatePassword')}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default ResetPasswordPage;
