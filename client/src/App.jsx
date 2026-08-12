import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import AppShell from './pages/AppShell';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountDeletedPage from './pages/AccountDeletedPage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import BillingSuccessPage from './pages/BillingSuccessPage';
import BillingCanceledPage from './pages/BillingCanceledPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/login" element={<AppShell />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account-deleted" element={<AccountDeletedPage />} />
          <Route path="/billing/success" element={<BillingSuccessPage />} />
          <Route path="/billing/canceled" element={<BillingCanceledPage />} />
          <Route path="/app" element={<AppShell />} />
          <Route path="/app/clients" element={<AppShell />} />
          <Route path="/app/keys" element={<AppShell />} />
          <Route path="/app/billing" element={<AppShell />} />
          <Route path="/app/team" element={<AppShell />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
