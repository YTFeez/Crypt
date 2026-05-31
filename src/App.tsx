import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { AppLayout } from "./layout/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { MessagesPage } from "./pages/MessagesPage";
import { FriendsPage } from "./pages/FriendsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { CallsPage } from "./pages/CallsPage";
import { FoldersPage } from "./pages/FoldersPage";
import { BoardsPage } from "./pages/BoardsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (!configured) return <Navigate to="/configuration" replace />;
  if (loading) return <div className="page-center"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/configuration" element={<SetupPage />} />
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
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
        <Route path="tableaux" element={<BoardsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
