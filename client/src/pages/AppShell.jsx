import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { docTypes } from '../lib/docTypes';
import { generateDocument } from '../lib/generateDocument';
import { usePreferences } from '../context/PreferencesContext';
import { languageOptions } from '../lib/translations';
import PasswordInput from '../components/shared/PasswordInput';

// The authenticated app (dashboard, clients, API keys, and the sign in /
// sign up form). Business logic here is unchanged from the original
// single-page App.jsx — only the routing mechanism was swapped from
// hand-rolled pushState/popstate to react-router, so it can coexist with
// the new public marketing routes.
function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, language, setLanguage, t } = usePreferences();

  const [activeDoc, setActiveDoc] = useState(docTypes[0]);
  const [promptText, setPromptText] = useState(docTypes[0].prompt);
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [savedDocs, setSavedDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ documentsCount: 0, clientsCount: 0 });
  const [form, setForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', case_type: '' });
  const [clientError, setClientError] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [keysLoading, setKeysLoading] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState(null);
  const [justCreatedKey, setJustCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokeError, setRevokeError] = useState(null);
  const [revokeSuccessId, setRevokeSuccessId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const settingsRef = useRef(null);
  const revokeSuccessTimeoutRef = useRef(null);

  const loadSavedDocs = async (token) => {
    try {
      const response = await fetch('/api/documents', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedDocs(data);
      }
    } catch (error) {
      console.error('Failed to load saved documents', error);
    }
  };

  const loadClients = async (token) => {
    try {
      const response = await fetch('/api/clients', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Failed to load clients', error);
    }
  };

  const loadStats = async (token) => {
    try {
      const response = await fetch('/api/stats', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats({ documentsCount: data.documentsCount ?? 0, clientsCount: data.clientsCount ?? 0 });
      }
    } catch (error) {
      console.error('Failed to load stats', error);
    }
  };

  const loadApiKeys = async (token) => {
    setKeysLoading(true);
    try {
      const response = await fetch('/api/keys', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Failed to load API keys', error);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session || null);
        setUser(data?.session?.user || null);
        const token = data?.session?.access_token;
        if (token) {
          await Promise.all([loadSavedDocs(token), loadClients(token), loadStats(token), loadApiKeys(token)]);
        }
      } catch (error) {
        console.warn('Auth session error:', error);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.access_token) {
        await Promise.all([
          loadSavedDocs(session.access_token),
          loadClients(session.access_token),
          loadStats(session.access_token),
          loadApiKeys(session.access_token)
        ]);
      } else {
        setSavedDocs([]);
        setClients([]);
        setStats({ documentsCount: 0, clientsCount: 0 });
        setApiKeys([]);
        setJustCreatedKey(null);
        setRevokeError(null);
        setRevokeSuccessId(null);
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!user && location.pathname !== '/login') {
      navigate('/login');
    } else if (user && location.pathname === '/login') {
      navigate('/app');
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  // Warn on tab close/refresh while a newly-generated key hasn't been
  // dismissed yet -- it can never be retrieved again after this point.
  useEffect(() => {
    if (!justCreatedKey) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [justCreatedKey]);

  useEffect(
    () => () => {
      if (revokeSuccessTimeoutRef.current) {
        clearTimeout(revokeSuccessTimeoutRef.current);
      }
    },
    []
  );

  const closeMobileNav = () => setMobileNavOpen(false);

  // In-app navigation (nav bar) unmounts AppShell and loses justCreatedKey
  // just as surely as leaving the tab -- gate it the same way.
  const guardedNavigate = (path) => {
    closeMobileNav();
    if (justCreatedKey && !window.confirm(t('keys_unsavedKeyWarning'))) {
      return;
    }
    navigate(path);
  };

  const activeDocButton = (doc) => {
    setActiveDoc(doc);
    setPromptText(doc.prompt);
    setGeneratedText('');
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleAuthChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const signIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const signUp = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const openForgotPassword = () => {
    setResetEmail(form.email);
    setResetError('');
    setResetSuccess(false);
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetError('');
    setResetSuccess(false);
  };

  const requestPasswordReset = async () => {
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      // Generic wording regardless of outcome -- never confirms or denies
      // whether an account exists for the submitted email.
      setResetSuccess(true);
    } catch (error) {
      console.error('Failed to request password reset', error);
      setResetError(t('login_resetErrorGeneric'));
    } finally {
      setResetLoading(false);
    }
  };

  const signOut = async () => {
    closeMobileNav();

    if (justCreatedKey && !window.confirm(t('keys_unsavedKeyWarning'))) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSavedDocs([]);
    setClients([]);
    setStats({ documentsCount: 0, clientsCount: 0 });
    setApiKeys([]);
    setJustCreatedKey(null);
    setRevokeError(null);
    setRevokeSuccessId(null);
    setSettingsOpen(false);
    navigate('/login');
  };

  const generateDoc = async () => {
    if (!session?.access_token) {
      setAuthError('Please sign in to generate documents.');
      return;
    }

    setLoading(true);
    setGeneratedText('');
    setSaveError('');
    setSaveSuccess(false);

    try {
      const content = await generateDocument({ prompt: promptText, documentType: activeDoc.title });
      setGeneratedText(content || 'Document generated successfully.');
    } catch (error) {
      console.error('Failed to generate document', error);
      setGeneratedText('There was a problem generating the document.');
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!session?.access_token) {
      setSaveError(t('dashboard_signInToSave'));
      return;
    }

    if (!generatedText.trim()) {
      setSaveError(t('dashboard_nothingToSave'));
      return;
    }

    setSaveLoading(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const saveResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: activeDoc.title, prompt: promptText, content: generatedText })
      });

      const saveData = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) {
        throw new Error(saveData?.error || 'Failed to save document');
      }

      setSaveSuccess(true);
      await loadSavedDocs(session.access_token);
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to save document', error);
      setSaveError(t('dashboard_saveErrorGeneric'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleClientChange = (field, value) => {
    setClientForm((prev) => ({ ...prev, [field]: value }));
  };

  const addClient = async () => {
    if (!session?.access_token) {
      setClientError('Please sign in to manage clients.');
      return;
    }

    setClientLoading(true);
    setClientError('');

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(clientForm)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to save client');
      }

      setClients((prev) => [data, ...prev]);
      setClientForm({ name: '', email: '', phone: '', case_type: '' });
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to create client', error);
      setClientError('Unable to save client. Please check your input.');
    } finally {
      setClientLoading(false);
    }
  };

  const removeClient = async (id) => {
    // Separate from the API keys confirm-before-revoke work below -- same
    // gap, flagged by the same audit, applied consistently here.
    if (!window.confirm(t('clients_confirmDelete'))) {
      return;
    }

    if (!session?.access_token) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (response.ok) {
        setClients((prev) => prev.filter((client) => client.id !== id));
        await loadStats(session.access_token);
      }
    } catch (error) {
      console.error('Failed to delete client', error);
    }
  };

  const createApiKey = async () => {
    if (justCreatedKey) {
      setApiKeyError(t('keys_dismissFirst'));
      return;
    }

    if (!session?.access_token) {
      setApiKeyError('Please sign in to create API keys.');
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError('');

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: apiKeyName.trim() || 'Default key' })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to create API key');
      }

      setJustCreatedKey(data.key);
      setApiKeyName('');
      await loadApiKeys(session.access_token);
    } catch (error) {
      console.error('Failed to create API key', error);
      setApiKeyError('Unable to create API key. Please try again.');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const revokeApiKey = async (id) => {
    if (!session?.access_token) {
      return;
    }

    if (!window.confirm(t('keys_confirmRevoke'))) {
      return;
    }

    setRevokingKeyId(id);
    setRevokeError(null);
    setRevokeSuccessId(null);
    if (revokeSuccessTimeoutRef.current) {
      clearTimeout(revokeSuccessTimeoutRef.current);
    }

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      if (justCreatedKey?.id === id) {
        setJustCreatedKey(null);
      }

      setRevokeSuccessId(id);
      revokeSuccessTimeoutRef.current = setTimeout(() => setRevokeSuccessId(null), 3000);
      await loadApiKeys(session.access_token);
    } catch (error) {
      console.error('Failed to revoke API key', error);
      setRevokeError({ id, message: t('keys_revokeErrorGeneric') });
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyApiKey = async () => {
    if (!justCreatedKey?.fullKey) return;
    try {
      await navigator.clipboard.writeText(justCreatedKey.fullKey);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy API key', error);
    }
  };

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : 'Never');

  const isLoginPage = location.pathname === '/login';
  const isDashboard = location.pathname === '/app';
  const isClients = location.pathname === '/app/clients';
  const isApiKeys = location.pathname === '/app/keys';

  return (
    <div className="app-shell">
      <nav className="nav">
        <button className="nav-logo" onClick={() => guardedNavigate('/app')}>
          Law<span>Scribe</span>
        </button>

        <button
          type="button"
          className="nav-toggle"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-links ${mobileNavOpen ? 'open' : ''}`}>
          <button className="nav-link" onClick={() => guardedNavigate('/app')}>
            {t('nav_dashboard')}
          </button>
          <button className="nav-link" onClick={() => guardedNavigate('/app/clients')}>
            {t('nav_clients')}
          </button>
          <button className="nav-link" onClick={() => guardedNavigate('/app/keys')}>
            {t('nav_apiKeys')}
          </button>
          {user ? (
            <button className="nav-cta" onClick={signOut}>
              {t('nav_signOut')}
            </button>
          ) : (
            <button
              className="nav-cta"
              onClick={() => {
                closeMobileNav();
                navigate('/login');
              }}
            >
              {t('nav_signIn')}
            </button>
          )}
        </div>
      </nav>

      <main>
        {isLoginPage && (
          <section className="auth-section">
            <div className="auth-panel">
              {!showForgotPassword ? (
                <>
                  <h2>{t('login_title')}</h2>
                  <label>{t('login_email')}</label>
                  <input type="email" value={form.email} onChange={(e) => handleAuthChange('email', e.target.value)} />
                  <label>{t('login_password')}</label>
                  <PasswordInput
                    value={form.password}
                    onChange={(e) => handleAuthChange('password', e.target.value)}
                    autoComplete="current-password"
                  />
                  <div className="forgot-password-row">
                    <button type="button" className="link-button" onClick={openForgotPassword}>
                      {t('login_forgotPassword')}
                    </button>
                  </div>
                  {authError && <p className="auth-error">{authError}</p>}
                  <div className="auth-actions">
                    <button disabled={authLoading} onClick={signIn}>
                      {authLoading ? t('login_signingIn') : t('login_signIn')}
                    </button>
                    <button disabled={authLoading} className="secondary" onClick={signUp}>
                      {authLoading ? t('login_registering') : t('login_createAccount')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{t('login_forgotTitle')}</h2>
                  <p>{t('login_forgotSubtitle')}</p>
                  {!resetSuccess ? (
                    <>
                      <label>{t('login_email')}</label>
                      <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                      {resetError && <p className="auth-error">{resetError}</p>}
                      <div className="auth-actions">
                        <button disabled={resetLoading} onClick={requestPasswordReset}>
                          {resetLoading ? t('login_sendingReset') : t('login_sendReset')}
                        </button>
                        <button className="secondary" onClick={closeForgotPassword}>
                          {t('login_backToSignIn')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="save-success">{t('login_resetSent')}</p>
                      <div className="auth-actions">
                        <button className="secondary" onClick={closeForgotPassword}>
                          {t('login_backToSignIn')}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {isDashboard && (
          <section className="dashboard-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('dashboard_label')}</span>
                <h2>
                  {t('dashboard_welcome')}
                  {user?.email ? `, ${user.email}` : ''}
                </h2>
                <p>{t('dashboard_subtitle')}</p>
              </div>

              <div className="settings-wrap" ref={settingsRef}>
                <button
                  type="button"
                  className="settings-trigger"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  ⚙ {t('settings_title')}
                </button>

                {settingsOpen && (
                  <div className="settings-panel">
                    <div className="settings-section">
                      <h4>{t('settings_account')}</h4>
                      <p className="settings-account-email">
                        {t('settings_signedInAs')} {user?.email}
                      </p>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_appearance')}</h4>
                      <div className="settings-row">
                        <span>{t('settings_darkMode')}</span>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                          <span className="toggle-switch-track" />
                        </label>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_language')}</h4>
                      <select
                        className="settings-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {languageOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>{t('dashboard_statDocuments')}</h3>
                <p>{stats.documentsCount}</p>
              </div>
              <div className="stat-card">
                <h3>{t('dashboard_statClients')}</h3>
                <p>{stats.clientsCount}</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-panel">
                <h3>{t('dashboard_generateTitle')}</h3>
                <div className="doc-types">
                  {docTypes.map((doc) => (
                    <button
                      key={doc.id}
                      className={`doc-option ${doc.id === activeDoc.id ? 'active' : ''}`}
                      onClick={() => activeDocButton(doc)}
                    >
                      <span>{doc.title}</span>
                    </button>
                  ))}
                </div>
                <label>{t('dashboard_promptLabel')}</label>
                <textarea className="dashboard-textarea" value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={7} />
                <button className="btn-primary generate-action" onClick={generateDoc} disabled={loading}>
                  {loading ? t('dashboard_generating') : t('dashboard_generate')}
                </button>
                {generatedText && (
                  <div className="output-panel">
                    <h4>{t('dashboard_generatedTitle')}</h4>
                    <textarea
                      className="dashboard-textarea"
                      value={generatedText}
                      onChange={(e) => {
                        setGeneratedText(e.target.value);
                        setSaveSuccess(false);
                      }}
                      rows={10}
                    />
                    {saveError && <p className="auth-error">{saveError}</p>}
                    {saveSuccess && <p className="save-success">{t('dashboard_saveSuccess')}</p>}
                    <button className="btn-primary generate-action" onClick={saveDocument} disabled={saveLoading}>
                      {saveLoading ? t('dashboard_saving') : t('dashboard_saveDocument')}
                    </button>
                  </div>
                )}
              </div>
              <div className="dashboard-panel">
                <h3>{t('dashboard_savedTitle')}</h3>
                {savedDocs.length === 0 ? (
                  <p>{t('dashboard_noSaved')}</p>
                ) : (
                  <ul className="saved-list">
                    {savedDocs.map((doc) => (
                      <li key={doc.id}>{doc.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {isClients && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('clients_label')}</span>
                <h2>{t('clients_title')}</h2>
                <p>{t('clients_subtitle')}</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <h3>{t('clients_addTitle')}</h3>
                <label>{t('clients_name')}</label>
                <input type="text" value={clientForm.name} onChange={(e) => handleClientChange('name', e.target.value)} />
                <label>{t('clients_email')}</label>
                <input type="email" value={clientForm.email} onChange={(e) => handleClientChange('email', e.target.value)} />
                <label>{t('clients_phone')}</label>
                <input type="text" value={clientForm.phone} onChange={(e) => handleClientChange('phone', e.target.value)} />
                <label>{t('clients_caseType')}</label>
                <input type="text" value={clientForm.case_type} onChange={(e) => handleClientChange('case_type', e.target.value)} />
                {clientError && <p className="auth-error">{clientError}</p>}
                <button className="btn-primary" disabled={clientLoading} onClick={addClient}>
                  {clientLoading ? t('clients_saving') : t('clients_save')}
                </button>
              </div>

              <div className="client-panel">
                <h3>{t('clients_listTitle')}</h3>
                {clients.length === 0 ? (
                  <p>{t('clients_noClients')}</p>
                ) : (
                  <ul className="client-list">
                    {clients.map((client) => (
                      <li key={client.id}>
                        <div>
                          <strong>{client.name}</strong>
                          <div>{client.email}</div>
                          <div>{client.phone}</div>
                        </div>
                        <button className="danger" onClick={() => removeClient(client.id)}>
                          {t('clients_delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {isApiKeys && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('keys_label')}</span>
                <h2>{t('keys_title')}</h2>
                <p>{t('keys_subtitle')}</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <h3>{t('keys_createTitle')}</h3>
                <label>{t('keys_nameLabel')}</label>
                <input
                  type="text"
                  placeholder="Default key"
                  value={apiKeyName}
                  maxLength={50}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  disabled={!!justCreatedKey}
                />
                {apiKeyError && <p className="auth-error">{apiKeyError}</p>}
                <button className="btn-primary" disabled={apiKeyLoading || !!justCreatedKey} onClick={createApiKey}>
                  {apiKeyLoading ? t('keys_creating') : t('keys_create')}
                </button>

                {justCreatedKey && (
                  <div className="output-panel">
                    <h4>{t('keys_copyNowTitle')}</h4>
                    <p>{t('keys_copyNowBody')}</p>
                    <p className="api-key-value">{justCreatedKey.fullKey}</p>
                    <div className="auth-actions">
                      <button className="btn-secondary" onClick={copyApiKey}>
                        {copied ? t('keys_copied') : t('keys_copy')}
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setJustCreatedKey(null);
                          setCopied(false);
                        }}
                      >
                        {t('keys_doneCopied')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="client-panel">
                <h3>{t('keys_yourKeys')}</h3>
                {keysLoading ? (
                  <p>{t('keys_loading')}</p>
                ) : apiKeys.length === 0 ? (
                  <p>{t('keys_noKeys')}</p>
                ) : (
                  <ul className="client-list">
                    {apiKeys.map((key) => (
                      <li key={key.id} className={key.revoked_at ? 'revoked' : ''}>
                        <div>
                          <strong>{key.name}</strong>
                          <div>{key.key_prefix}…</div>
                          <div>
                            {t('keys_created')} {formatDate(key.created_at)}
                          </div>
                          <div>
                            {t('keys_lastUsed')} {formatDate(key.last_used_at)}
                          </div>
                          <div>
                            {key.revoked_at ? (
                              <>
                                <span className="key-badge">{t('keys_revoked')}</span> {formatDate(key.revoked_at)}
                              </>
                            ) : (
                              t('keys_active')
                            )}
                          </div>
                          {revokeError?.id === key.id && <p className="auth-error">{revokeError.message}</p>}
                          {revokeSuccessId === key.id && <p className="save-success">{t('keys_revokeSuccess')}</p>}
                        </div>
                        {!key.revoked_at && (
                          <button
                            className="danger"
                            disabled={revokingKeyId === key.id}
                            onClick={() => revokeApiKey(key.id)}
                          >
                            {revokingKeyId === key.id ? t('keys_revoking') : t('keys_revoke')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <a href="#" className="footer-logo">
          Law<span>Scribe</span>
        </a>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Help</a>
          <a href="#">Contact</a>
        </div>
        <div className="footer-copy">© 2026 LawScribe. Not a law firm.</div>
      </footer>
    </div>
  );
}

export default AppShell;
