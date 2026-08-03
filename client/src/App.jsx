import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import AppShell from './pages/AppShell';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountDeletedPage from './pages/AccountDeletedPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<AppShell />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account-deleted" element={<AccountDeletedPage />} />
          <Route path="/app" element={<AppShell />} />
          <Route path="/app/clients" element={<AppShell />} />
          <Route path="/app/keys" element={<AppShell />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
