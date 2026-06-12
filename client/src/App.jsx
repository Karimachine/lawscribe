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
  const [form, setForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session || null);
        setUser(data?.session?.user || null);
        if (data?.session) {
          await loadSavedDocs(data.session.access_token);
        }
      } catch (error) {
        console.warn('Auth session error:', error);
      }
    };

    fetchSession();

    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        setSession(session);
        setUser(session?.user || null);
        if (session) {
          await loadSavedDocs(session.access_token);
        } else {
          setSavedDocs([]);
        }
      });

      return () => {
        if (data?.subscription) {
          data.subscription.unsubscribe();
        }
      };
    } catch (error) {
      console.warn('Auth subscription error:', error);
    }
  }, []);

  const activeDocButton = (doc) => {
    setActiveDoc(doc);
    setPromptText(doc.prompt);
    setGeneratedText('');
  };

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
  };

  const generateDoc = async () => {
    setLoading(true);
    setGeneratedText('');

    setTimeout(async () => {
      setGeneratedText(sampleContent);
      if (session?.access_token) {
        try {
          await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ title: activeDoc.title, prompt: promptText, content: sampleContent })
          });
          await loadSavedDocs(session.access_token);
        } catch (error) {
          console.error('Failed to save document', error);
        }
      }
      setLoading(false);
    }, 800);
  };

  const heroSub = useMemo(
    () =>
      'Draft contracts, agreements, NDAs, and more with AI trained on thousands of legal templates. No lawyer required for everyday documents.',
    []
  );

  return (
    <div className="app-shell">
      <nav className="nav">
        <a href="#" className="nav-logo">
          Law<span>Scribe</span>
        </a>
        <div className="nav-links">
          <a href="#documents">Documents</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          {user ? (
            <button className="nav-cta" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <a href="#auth" className="nav-cta">
              Sign in
            </a>
          )}
        </div>
      </nav>

      <main>
        <section className="hero" id="hero">
          <span className="hero-badge">AI-Powered Legal Drafting</span>
          <h1>
            Legal documents,
            <br />
            <em>written in minutes</em>
          </h1>
          <p className="hero-sub">{heroSub}</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={generateDoc}>
              {loading ? 'Generating…' : 'Generate a document →'}
            </button>
            <a href="#how-it-works" className="btn-secondary">
              See how it works
            </a>
          </div>
          <div className="social-proof">
            <span>Trusted by 12,000+ individuals & businesses</span>
            <span>★★★★★ 4.9 rating</span>
            <span>50+ document types</span>
          </div>
        </section>

        <section className="demo-wrap" id="demo-section">
          <div className="demo-card">
            <div className="demo-bar">
              <div className="demo-dot" />
              <div className="demo-dot" />
              <div className="demo-dot" />
            </div>
            <div className="demo-inner">
              <aside className="demo-sidebar">
                <div className="demo-sidebar-label">My Documents</div>
                {docTypes.map((doc) => (
                  <button
                    key={doc.id}
                    className={`doc-item ${doc.id === activeDoc.id ? 'active' : ''}`}
                    onClick={() => activeDocButton(doc)}
                  >
                    <span className="doc-icon">{doc.label}</span>
                    {doc.title}
                  </button>
                ))}
              </aside>
              <div className="demo-main">
                <div className="demo-prompt-label">Your request</div>
                <div className="demo-prompt-box">{promptText}</div>
                <button className="generate-btn" onClick={generateDoc} disabled={loading}>
                  {loading ? '✦ Generating...' : '✦ Generate document'}
                </button>
                {generatedText && (
                  <div className="demo-output">
                    <div className="demo-output-title">Generated document preview</div>
                    <p>{generatedText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="documents">
          <div className="section-header">
            <span className="section-label">Document Library</span>
            <h2>Every document your business needs</h2>
            <p className="section-sub">
              From simple NDAs to complex partnership agreements — generated, not just templated.
            </p>
          </div>
          <div className="doc-grid">
            {docTypes.map((card) => (
              <div key={card.id} className="doc-card">
                <div className="doc-card-icon">📋</div>
                <h3>{card.title}</h3>
                <p>{card.prompt}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section steps-bg" id="how-it-works">
          <div className="section-header">
            <span className="section-label">Process</span>
            <h2>Three steps to a signed document</h2>
            <p className="section-sub">From blank page to legally sound document in under five minutes.</p>
          </div>
          <div className="steps-grid">
            <div className="step">
              <div className="step-num">01</div>
              <h3>Describe your situation</h3>
              <p>Tell us in plain English what you need. Mention the parties involved, key terms, and any specific requirements.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>AI drafts your document</h3>
              <p>Our model generates a complete, jurisdiction-aware document with proper legal language and all standard clauses.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>Edit, export & sign</h3>
              <p>Review and refine inline, then download as PDF or Word. Send for e-signature directly from LawScribe.</p>
            </div>
          </div>
        </section>

        <section className="section testimonials-bg">
          <div className="section-header">
            <span className="section-label">Testimonials</span>
            <h2>Trusted by founders, freelancers & families</h2>
            <p className="section-sub section-sub-light">Real people using LawScribe for real documents.</p>
          </div>
          <div className="testi-grid">
            <article className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">"Generated a contractor NDA in under two minutes. My lawyer would have charged $400 for the same thing."</p>
              <div className="testi-author">
                <span className="testi-avatar">MK</span>
                <div>
                  <div className="testi-name">Marcus Kim</div>
                  <div className="testi-role">Founder, Wavefront Studio</div>
                </div>
              </div>
            </article>
            <article className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">"The lease agreement it drafted for my rental property was thorough and state-specific. Genuinely impressive."</p>
              <div className="testi-author">
                <span className="testi-avatar">RL</span>
                <div>
                  <div className="testi-name">Rachel Liu</div>
                  <div className="testi-role">Property owner, Austin TX</div>
                </div>
              </div>
            </article>
            <article className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-text">"As a freelancer, I used to just hope for the best with clients. Now I have proper contracts for every project."</p>
              <div className="testi-author">
                <span className="testi-avatar">JP</span>
                <div>
                  <div className="testi-name">James Patel</div>
                  <div className="testi-role">Independent designer</div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="section-header centered">
            <span className="section-label">Pricing</span>
            <h2>Simple, honest pricing</h2>
            <p className="section-sub">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="pricing-grid">
            <div className="plan">
              <div className="plan-name">Starter</div>
              <div className="plan-price">Free</div>
              <div className="plan-desc">For individuals with occasional document needs.</div>
              <div className="plan-divider" />
              <div className="plan-feature">3 documents per month</div>
              <div className="plan-feature">PDF export</div>
              <div className="plan-feature">10 document types</div>
              <div className="plan-feature">Basic editing tools</div>
              <button className="plan-btn">Get started free</button>
            </div>
            <div className="plan featured">
              <div className="plan-badge">Most popular</div>
              <div className="plan-name">Professional</div>
              <div className="plan-price">$19 <span>/ mo</span></div>
              <div className="plan-desc">For freelancers and small businesses drafting regularly.</div>
              <div className="plan-divider" />
              <div className="plan-feature">Unlimited documents</div>
              <div className="plan-feature">PDF & Word export</div>
              <div className="plan-feature">All 50+ document types</div>
              <div className="plan-feature">E-signature (5 per month)</div>
              <button className="plan-btn featured">Start 7-day free trial</button>
            </div>
            <div className="plan">
              <div className="plan-name">Business</div>
              <div className="plan-price">$59 <span>/ mo</span></div>
              <div className="plan-desc">For teams and businesses with high-volume needs.</div>
              <div className="plan-divider" />
              <div className="plan-feature">Everything in Professional</div>
              <div className="plan-feature">Unlimited e-signatures</div>
              <div className="plan-feature">Team collaboration</div>
              <div className="plan-feature">Custom clause library</div>
              <button className="plan-btn">Start 7-day free trial</button>
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <span className="section-label">Get started today</span>
          <h2>Your first document is on us</h2>
          <p>No credit card required. No legal jargon. Just documents that work.</p>
          <button className="btn-primary">Generate your first document →</button>
        </section>

        <section className="section auth-section" id="auth">
          <div className="auth-panel">
            <h3>{user ? 'Welcome back' : 'Sign in to save documents'}</h3>
            {user ? (
              <p>Signed in as <strong>{user.email}</strong>.</p>
            ) : (
              <>
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
              </>
            )}
            {user && (
              <div className="saved-docs">
                <h4>Saved Documents</h4>
                {savedDocs.length === 0 ? (
                  <p>No saved documents yet.</p>
                ) : (
                  <ul>
                    {savedDocs.map((doc) => (
                      <li key={doc._id}>{doc.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
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
