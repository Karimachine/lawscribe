import NavBar from '../components/nav/NavBar';
import Footer from '../components/shared/Footer';

const steps = [
  {
    label: '1',
    title: 'Describe your document',
    description: 'Tell LawScribe what you need in plain English — the parties involved, key terms, and any specifics.'
  },
  {
    label: '2',
    title: 'AI drafts it',
    description: 'Our AI, trained on thousands of legal templates, generates a complete first draft in seconds.'
  },
  {
    label: '3',
    title: 'Review & download',
    description: 'Read through the draft, make any edits you need, and download or save it to your account.'
  }
];

function AboutPage() {
  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <section className="section">
          <div className="section-header">
            <span className="section-label">About LawScribe</span>
            <h2>Legal drafting, made fast</h2>
            <p className="section-sub">
              LawScribe helps freelancers, small businesses, and solo practitioners generate everyday legal
              documents — NDAs, service contracts, leases, and more — in seconds instead of hours, using AI trained
              on thousands of legal templates.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <span className="section-label">How it works</span>
            <h2>Three steps to a finished draft</h2>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <div key={step.label} className="doc-card">
                <span className="doc-card-icon doc-icon">{step.label}</span>
                <h3>{step.title}</h3>
                <p className="plan-desc">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <div className="disclaimer-box">
              <h3>Not a substitute for legal advice</h3>
              <p>
                LawScribe generates draft documents using AI. It is not a law firm, does not provide legal advice,
                and using it does not create an attorney-client relationship. Generated drafts should be reviewed —
                and, for anything important, reviewed by a licensed attorney in your jurisdiction — before you rely
                on or sign them.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default AboutPage;
