import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NavBar from '../components/nav/NavBar';
import Hero from '../components/home/Hero';
import DemoGenerator from '../components/home/DemoGenerator';
import PricingSection from '../components/home/PricingSection';
import Footer from '../components/shared/Footer';

function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <Hero />
        <DemoGenerator />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
