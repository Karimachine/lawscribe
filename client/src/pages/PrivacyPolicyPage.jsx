import NavBar from '../components/nav/NavBar';
import Footer from '../components/shared/Footer';

// PLACEHOLDER CONTENT -- every section body below is filler text, not
// reviewed legal language. Do not ship this to production before a lawyer
// has replaced it with an actual reviewed privacy policy.
const sections = [
  {
    title: '1. Information we collect',
    body: 'Placeholder: describe what account, usage, and payment data LawScribe collects (e.g. email address, generated documents, client records you enter, billing details processed by Stripe).'
  },
  {
    title: '2. How we use your information',
    body: 'Placeholder: describe the purposes data is used for (e.g. providing the document-generation service, billing, support, security).'
  },
  {
    title: '3. How we share your information',
    body: 'Placeholder: list third-party processors (e.g. Supabase for data storage, Anthropic for document generation, Stripe for billing) and under what circumstances data is shared.'
  },
  {
    title: '4. Data retention',
    body: 'Placeholder: describe how long data is retained and what happens to it when an account is deleted.'
  },
  {
    title: '5. Your rights',
    body: 'Placeholder: describe applicable rights (access, correction, deletion, export) and how to exercise them.'
  },
  {
    title: '6. Security',
    body: 'Placeholder: describe security measures taken to protect user data.'
  },
  {
    title: '7. Changes to this policy',
    body: 'Placeholder: describe how and when this policy may be updated, and how users will be notified.'
  }
];

function PrivacyPolicyPage() {
  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <section className="section">
          <div className="section-header">
            <span className="section-label">Legal</span>
            <h2>Privacy Policy</h2>
          </div>

          <div className="disclaimer-box">
            <h3>PLACEHOLDER — not final legal text</h3>
            <p>
              Everything below is placeholder copy standing in for a real privacy policy. It has not been written or
              reviewed by a lawyer and must not be treated as LawScribe's actual privacy policy. Replace this page's
              content with reviewed legal text before launch.
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

export default PrivacyPolicyPage;
