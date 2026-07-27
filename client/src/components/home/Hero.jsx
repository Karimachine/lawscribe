import { Link } from 'react-router-dom';

function Hero() {
  return (
    <section className="hero">
      <span className="hero-badge">AI-Powered Legal Drafting</span>
      <h1>
        Generate legal documents in <em>seconds</em> with AI
      </h1>
      <p className="hero-sub">
        Draft contracts, agreements, NDAs, and more with AI trained on thousands of legal templates. No lawyer
        required for everyday documents.
      </p>
      <div className="hero-actions">
        <a href="#demo" className="btn-primary">
          Try the Demo
        </a>
        <Link to="/login" className="btn-secondary">
          Sign Up Free
        </Link>
      </div>
    </section>
  );
}

export default Hero;
