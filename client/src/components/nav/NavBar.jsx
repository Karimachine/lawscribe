import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo" onClick={closeMobileMenu}>
        Law<span>Scribe</span>
      </Link>

      <button
        type="button"
        className="nav-toggle"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-links ${mobileOpen ? 'open' : ''}`}>
        <NavLink
          to="/about"
          className={({ isActive }) => (isActive ? 'active' : '')}
          onClick={closeMobileMenu}
        >
          About
        </NavLink>
        <Link to="/#pricing" onClick={closeMobileMenu}>
          Pricing
        </Link>
        <Link to="/login" className="nav-cta" onClick={closeMobileMenu}>
          Login / Sign Up
        </Link>
      </div>
    </nav>
  );
}

export default NavBar;
