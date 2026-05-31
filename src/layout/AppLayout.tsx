import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import {
  IconMessage,
  IconUsers,
  IconPhone,
  IconFolder,
  IconBoard,
  IconSettings,
  IconHome,
  IconSearch,
} from "../components/Icons";

const nav = [
  { to: "/app/messages", label: "Messages", Icon: IconMessage },
  { to: "/app/amis", label: "Contacts", Icon: IconUsers },
  { to: "/app/groupes", label: "Groupes", Icon: IconUsers },
  { to: "/app/appels", label: "Appels", Icon: IconPhone },
  { to: "/app/dossiers", label: "Dossiers", Icon: IconFolder },
  { to: "/app/tableaux", label: "Tableaux", Icon: IconBoard },
] as const;

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const initial = profile?.display_name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/app" className="logo-wordmark">
          <Logo size={28} />
          <span>SecureHub</span>
        </Link>
        <div className="topbar-search">
          <IconSearch size={16} />
          <input type="search" placeholder="Rechercher…" aria-label="Rechercher" />
        </div>
        <NavLink to="/app/parametres" className="topbar-user" title="Paramètres">
          <span className="avatar sm">{initial}</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{profile?.display_name?.split(" ")[0]}</span>
        </NavLink>
      </header>

      <div className="app-body">
        <nav className="nav-rail" aria-label="Navigation">
          <NavLink to="/" className="rail-link" title="Accueil">
            <IconHome size={22} />
          </NavLink>
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}
              title={label}
            >
              <Icon size={22} />
            </NavLink>
          ))}
          <div className="rail-spacer" />
          <NavLink to="/app/parametres" className="rail-link" title="Paramètres">
            <IconSettings size={22} />
          </NavLink>
          <button type="button" className="rail-link" title="Déconnexion" onClick={() => void signOut()}>
            <span style={{ fontSize: "1.1rem" }}>⎋</span>
          </button>
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
