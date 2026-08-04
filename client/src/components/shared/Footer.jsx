import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer">
      <Link to="/" className="footer-logo">
        Law<span>Scribe</span>
      </Link>
      <div className="footer-links">
        <Link to="/about">About</Link>
        <Link to="/#pricing">Pricing</Link>
        <Link to="/login">Login</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <a href="mailto:hello@lawscribe.app">Contact</a>
      </div>
      <div className="footer-copy">© 2026 LawScribe. Not a law firm.</div>
    </footer>
  );
}

export default Footer;
