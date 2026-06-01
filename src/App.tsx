import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { AppLayout } from "./layout/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { MessagesPage } from "./pages/MessagesPage";
import { FriendsPage } from "./pages/FriendsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { CallsPage } from "./pages/CallsPage";
import { FoldersPage } from "./pages/FoldersPage";
import { DesignStudioPage } from "./pages/DesignStudioPage";
import { ArchivesPage } from "./pages/ArchivesPage";
import { SettingsPage } from "./pages/SettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/verification-email" element={<VerifyEmailPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="messages" replace />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="amis" element={<FriendsPage />} />
        <Route path="groupes" element={<GroupsPage />} />
        <Route path="appels" element={<CallsPage />} />
        <Route path="dossiers" element={<FoldersPage />} />
        <Route path="archives" element={<ArchivesPage />} />
        <Route path="studio" element={<DesignStudioPage />} />
        <Route path="tableaux" element={<Navigate to="/app/studio" replace />} />
        <Route path="parametres" element={<SettingsPage />} />
      </Route>
      <Route path="/configuration" element={<Navigate to="/connexion" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
