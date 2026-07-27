import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { docTypes } from '../lib/docTypes';
import { generateDocument } from '../lib/generateDocument';

// The authenticated app (dashboard, clients, and the sign in / sign up form).
// Business logic here is unchanged from the original single-page App.jsx —
// only the routing mechanism was swapped from hand-rolled pushState/popstate
// to react-router, so it can coexist with the new public marketing routes.
function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeDoc, setActiveDoc] = useState(docTypes[0]);
  const [promptText, setPromptText] = useState(docTypes[0].prompt);
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [savedDocs, setSavedDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ documentsCount: 0, clientsCount: 0 });
  const [form, setForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', case_type: '' });
  const [clientError, setClientError] = useState('');
  const [clientLoading, setClientLoading] = useState(false);

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

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session || null);
        setUser(data?.session?.user || null);
        const token = data?.session?.access_token;
        if (token) {
          await Promise.all([loadSavedDocs(token), loadClients(token), loadStats(token)]);
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
        await Promise.all([loadSavedDocs(session.access_token), loadClients(session.access_token), loadStats(session.access_token)]);
      } else {
        setSavedDocs([]);
        setClients([]);
        setStats({ documentsCount: 0, clientsCount: 0 });
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

  const activeDocButton = (doc) => {
    setActiveDoc(doc);
    setPromptText(doc.prompt);
    setGeneratedText('');
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSavedDocs([]);
    setClients([]);
    setStats({ documentsCount: 0, clientsCount: 0 });
    navigate('/login');
  };

  const generateDoc = async () => {
    if (!session?.access_token) {
      setAuthError('Please sign in to generate documents.');
      return;
    }

    setLoading(true);
    setGeneratedText('');

    try {
      const content = await generateDocument({ prompt: promptText, documentType: activeDoc.title });
      setGeneratedText(content || 'Document generated successfully.');

      const saveResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: activeDoc.title, prompt: promptText, content })
      });

      if (!saveResponse.ok) {
        const saveData = await saveResponse.json().catch(() => ({}));
        throw new Error(saveData?.error || 'Failed to save document');
      }

      await loadSavedDocs(session.access_token);
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to generate document', error);
      setGeneratedText('There was a problem generating the document.');
    } finally {
      setLoading(false);
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

  const isLoginPage = location.pathname === '/login';
  const isDashboard = location.pathname === '/app';
  const isClients = location.pathname === '/app/clients';

  return (
    <div className="app-shell">
      <nav className="nav">
        <button className="nav-logo" onClick={() => navigate('/app')}>
          Law<span>Scribe</span>
        </button>
        <div className="nav-links">
          <button className="nav-link" onClick={() => navigate('/app')}>
            Dashboard
          </button>
          <button className="nav-link" onClick={() => navigate('/app/clients')}>
            Clients
          </button>
          {user ? (
            <button className="nav-cta" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <button className="nav-cta" onClick={() => navigate('/login')}>
              Sign in
            </button>
          )}
        </div>
      </nav>

      <main>
        {isLoginPage && (
          <section className="auth-section">
            <div className="auth-panel">
              <h2>Sign in to LawScribe</h2>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => handleAuthChange('email', e.target.value)} />
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => handleAuthChange('password', e.target.value)} />
              {authError && <p className="auth-error">{authError}</p>}
              <div className="auth-actions">
                <button disabled={authLoading} onClick={signIn}>
                  {authLoading ? 'Signing in…' : 'Sign in'}
                </button>
                <button disabled={authLoading} className="secondary" onClick={signUp}>
                  {authLoading ? 'Registering…' : 'Create account'}
                </button>
              </div>
            </div>
          </section>
        )}

        {isDashboard && (
          <section className="dashboard-page">
            <div className="page-header">
              <div>
                <span className="section-label">Dashboard</span>
                <h2>Welcome back{user?.email ? `, ${user.email}` : ''}</h2>
                <p>Manage your documents, clients, and generate new legal content.</p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Documents</h3>
                <p>{stats.documentsCount}</p>
              </div>
              <div className="stat-card">
                <h3>Clients</h3>
                <p>{stats.clientsCount}</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-panel">
                <h3>Generate a new document</h3>
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
                <label>Prompt</label>
                <textarea className="dashboard-textarea" value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={7} />
                <button className="btn-primary generate-action" onClick={generateDoc} disabled={loading}>
                  {loading ? 'Generating…' : 'Generate document'}
                </button>
                {generatedText && (
                  <div className="output-panel">
                    <h4>Generated document</h4>
                    <p>{generatedText}</p>
                  </div>
                )}
              </div>
              <div className="dashboard-panel">
                <h3>Saved documents</h3>
                {savedDocs.length === 0 ? (
                  <p>No saved documents yet.</p>
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
                <span className="section-label">Clients</span>
                <h2>Client directory</h2>
                <p>Add, view, and remove clients from your roster.</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <h3>Add a client</h3>
                <label>Name</label>
                <input type="text" value={clientForm.name} onChange={(e) => handleClientChange('name', e.target.value)} />
                <label>Email</label>
                <input type="email" value={clientForm.email} onChange={(e) => handleClientChange('email', e.target.value)} />
                <label>Phone</label>
                <input type="text" value={clientForm.phone} onChange={(e) => handleClientChange('phone', e.target.value)} />
                <label>Case type</label>
                <input type="text" value={clientForm.case_type} onChange={(e) => handleClientChange('case_type', e.target.value)} />
                {clientError && <p className="auth-error">{clientError}</p>}
                <button className="btn-primary" disabled={clientLoading} onClick={addClient}>
                  {clientLoading ? 'Saving…' : 'Save client'}
                </button>
              </div>

              <div className="client-panel">
                <h3>Client list</h3>
                {clients.length === 0 ? (
                  <p>No clients yet.</p>
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
                          Delete
                        </button>
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
