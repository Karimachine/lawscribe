import { useEffect, useMemo, useState } from 'react';
import { supabase } from './api/supabaseClient';

const docTypes = [
  {
    id: 0,
    label: 'NDA',
    title: 'Non-Disclosure Agreement',
    prompt: 'Draft a mutual NDA between Acme Corp and a freelance designer named Sarah Chen. Include a 2-year confidentiality period and cover all design assets and client lists.'
  },
  {
    id: 1,
    label: 'SC',
    title: 'Service Contract',
    prompt: 'Create a service contract for a web development project worth $8,000, with milestone payments, a 30-day revision period, and IP transfer upon final payment.'
  },
  {
    id: 2,
    label: 'LA',
    title: 'Lease Agreement',
    prompt: 'Generate a residential lease agreement for a 1BR apartment in Austin, TX at $1,650/month, 12-month term, no pets, utilities excluded.'
  },
  {
    id: 3,
    label: 'PP',
    title: 'Privacy Policy',
    prompt: 'Write a GDPR-compliant privacy policy for a SaaS product that collects email addresses and usage analytics. Include data retention and deletion rights.'
  },
  {
    id: 4,
    label: 'EO',
    title: 'Employment Offer',
    prompt: 'Draft an employment offer letter for a full-time marketing manager role, $75k salary, 15 days PTO, health benefits, and 90-day probation period.'
  },
  {
    id: 5,
    label: 'PA',
    title: 'Partnership Agreement',
    prompt: 'Create a 50/50 partnership agreement between two co-founders for a software startup, covering decision-making, profit sharing, and exit provisions.'
  }
];

const sampleContent = `This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the date last signed below, by and between Acme Corp, a corporation ("Disclosing Party"), and Sarah Chen, a freelance designer ("Receiving Party").

1. CONFIDENTIAL INFORMATION. Each party may disclose to the other certain proprietary information including but not limited to design assets, client lists, business strategies, and technical data ("Confidential Information").

2. OBLIGATIONS. Each party agrees to hold the other's Confidential Information in strict confidence for a period of two (2) years from the date of disclosure...`;

function App() {
  const [activeDoc, setActiveDoc] = useState(docTypes[0]);
  const [promptText, setPromptText] = useState(docTypes[0].prompt);
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [savedDocs, setSavedDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ documentsCount: 0, clientsCount: 0 });
  const [route, setRoute] = useState(() => {
    const path = window.location.pathname;
    if (['/login', '/dashboard', '/clients'].includes(path)) {
      return path;
    }
    window.history.replaceState({}, '', '/dashboard');
    return '/dashboard';
  });
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
    const onPopState = () => {
      const path = window.location.pathname;
      if (['/login', '/dashboard', '/clients'].includes(path)) {
        setRoute(path);
      } else {
        window.history.replaceState({}, '', '/dashboard');
        setRoute('/dashboard');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setRoute(path);
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
    if (!user && route !== '/login') {
      navigate('/login');
    } else if (user && route === '/login') {
      navigate('/dashboard');
    }
  }, [user, route]);

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
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: promptText, documentType: activeDoc.title })
      });

      const generateData = await generateResponse.json();
      if (!generateResponse.ok) {
        throw new Error(generateData?.error || 'Failed to generate document');
      }

      const content = generateData.content || 'Document generated successfully.';
      setGeneratedText(content);

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

  const heroSub = useMemo(
    () =>
      'Draft contracts, agreements, NDAs, and more with AI trained on thousands of legal templates. No lawyer required for everyday documents.',
    []
  );

  const isLoginPage = route === '/login';
  const isDashboard = route === '/dashboard';
  const isClients = route === '/clients';

  return (
    <div className="app-shell">
      <nav className="nav">
        <button className="nav-logo" onClick={() => navigate('/dashboard')}>
          Law<span>Scribe</span>
        </button>
        <div className="nav-links">
          <button className="nav-link" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="nav-link" onClick={() => navigate('/clients')}>
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

export default App;
