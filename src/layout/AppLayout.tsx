import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import { ParticleNetwork } from "../components/ParticleNetwork";
import {
  IconMessage,
  IconUser,
  IconUsers,
  IconPhone,
  IconFolder,
  IconArchive,
  IconPalette,
  IconSettings,
  IconHome,
  IconSearch,
  IconLogOut,
} from "../components/Icons";

const nav = [
  { to: "/app/messages", label: "Messages", Icon: IconMessage },
  { to: "/app/amis", label: "Contacts", Icon: IconUser },
  { to: "/app/groupes", label: "Groupes", Icon: IconUsers },
  { to: "/app/appels", label: "Appels", Icon: IconPhone },
  { to: "/app/dossiers", label: "Dossiers", Icon: IconFolder },
  { to: "/app/archives", label: "Archives", Icon: IconArchive },
  { to: "/app/studio", label: "Studio", Icon: IconPalette },
] as const;

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const initial = profile?.display_name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="app-shell">
      <ParticleNetwork variant="light" />
      <header className="app-topbar">
        <Link to="/app" className="logo-wordmark" style={{ marginRight: "auto" }}>
          <Logo size={44} />
          <span className="logo-wordmark-text">Talkeo</span>
        </Link>
        <div className="topbar-search">
          <IconSearch size={16} />
          <input type="search" placeholder="Rechercher…" aria-label="Rechercher" />
        </div>
        <NavLink to="/app/parametres" className="topbar-user" title="Paramètres">
          <div className="avatar-wrap">
            <span className="avatar sm">{initial}</span>
            <span className="status-dot online" aria-label="En ligne" />
          </div>
          <span className="topbar-user-name">{profile?.display_name?.split(" ")[0]}</span>
        </NavLink>
      </header>

      <div className="app-body">
        <nav className="nav-rail" aria-label="Navigation principale">
          <NavLink to="/" className="rail-link" title="Accueil">
            <IconHome size={20} />
            <span className="rail-label">Accueil</span>
          </NavLink>

          <div className="rail-divider" />

          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}
              title={label}
            >
              <Icon size={20} />
              <span className="rail-label">{label}</span>
            </NavLink>
          ))}

          <div className="rail-spacer" />

          <NavLink to="/app/parametres" className="rail-link" title="Paramètres">
            <IconSettings size={20} />
            <span className="rail-label">Config</span>
          </NavLink>

          <button
            type="button"
            className="rail-link rail-link--logout"
            title="Déconnexion"
            onClick={() => void signOut()}
          >
            <IconLogOut size={20} />
            <span className="rail-label">Quitter</span>
          </button>
        </nav>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
