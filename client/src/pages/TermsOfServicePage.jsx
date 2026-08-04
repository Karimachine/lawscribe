import NavBar from '../components/nav/NavBar';
import Footer from '../components/shared/Footer';

// PLACEHOLDER CONTENT -- every section body below is filler text, not
// reviewed legal language. Do not ship this to production before a lawyer
// has replaced it with actual reviewed terms of service.
const sections = [
  {
    title: '1. Acceptance of terms',
    body: 'Placeholder: describe what it means to create an account and use LawScribe, and that doing so constitutes acceptance of these terms.'
  },
  {
    title: '2. Description of service',
    body: 'Placeholder: describe the document-generation, client-management, and API-key features, and that LawScribe is not a law firm and does not provide legal advice.'
  },
  {
    title: '3. Subscriptions and billing',
    body: 'Placeholder: describe subscription billing terms, renewal, cancellation, and refund policy for paid plans processed via Stripe.'
  },
  {
    title: '4. Acceptable use',
    body: 'Placeholder: describe prohibited uses of the service (e.g. unlawful purposes, abuse, reverse engineering, reselling access).'
  },
  {
    title: '5. Disclaimers',
    body: 'Placeholder: describe that generated documents are drafts, are not legal advice, and should be reviewed by a licensed attorney before use.'
  },
  {
    title: '6. Limitation of liability',
    body: 'Placeholder: describe the limits of LawScribe’s liability for damages arising from use of the service.'
  },
  {
    title: '7. Termination',
    body: 'Placeholder: describe the conditions under which an account or subscription may be terminated, by either party.'
  },
  {
    title: '8. Changes to these terms',
    body: 'Placeholder: describe how and when these terms may be updated, and how users will be notified.'
  }
];

function TermsOfServicePage() {
  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <section className="section">
          <div className="section-header">
            <span className="section-label">Legal</span>
            <h2>Terms of Service</h2>
          </div>

          <div className="disclaimer-box">
            <h3>PLACEHOLDER — not final legal text</h3>
            <p>
              Everything below is placeholder copy standing in for real terms of service. It has not been written or
              reviewed by a lawyer and must not be treated as LawScribe's actual terms. Replace this page's content
              with reviewed legal text before launch.
            </p>
          </div>

          <div className="legal-body">
            {sections.map((section) => (
              <div key={section.title} className="legal-section">
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default TermsOfServicePage;
