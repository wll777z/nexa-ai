import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ContactsPage from './pages/ContactsPage';
import CreateSitePage from './pages/CreateSitePage';
import MySitesPage from './pages/MySitesPage';
import EditorPage from './pages/EditorPage';
import AiBuilderPage from './pages/AiBuilderPage';
import ProspectingPage from './pages/ProspectingPage';

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-app gap-3">
        <span className="spinner-ring w-6 h-6" aria-hidden="true" />
        <div className="text-ink-base text-sm" role="status" aria-live="polite">
          Carregando...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/create-site" element={<CreateSitePage />} />
      <Route path="/ai-builder" element={<AiBuilderPage />} />
      <Route path="/ai-builder/:id" element={<AiBuilderPage />} />
      <Route path="/my-sites" element={<MySitesPage />} />
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/prospecting" element={<ProspectingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
