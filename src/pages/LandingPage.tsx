import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";

const FEATURES = [
  { title: "Messagerie", desc: "Conversations chiffrées de bout en bout, en direct ou en groupe." },
  { title: "Appels", desc: "Audio et visio intégrés, sans application tierce." },
  { title: "Dossiers", desc: "Fichiers partagés avec droits d'accès par membre." },
  { title: "Studio", desc: "Visuels et présentations, directement dans Talkeo." },
  { title: "Sécurité", desc: "AES-256-GCM, Argon2id. Vos données restent les vôtres." },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const { user, signInAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  async function tryDemo() {
    setGuestLoading(true);
    const err = await signInAsGuest();
    setGuestLoading(false);
    if (!err) navigate("/app");
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="marketing">
      <header className={`marketing-nav${scrolled ? " scrolled" : ""}`}>
        <Link to="/" className="logo-wordmark">
          <LogoWordmark />
        </Link>
        <nav className="marketing-nav-links" aria-label="Principal">
          <a href="#produit">Produit</a>
          <a href="#securite">Sécurité</a>
        </nav>
        <div className="marketing-nav-actions">
          {user ? (
            <Link to="/app" className="btn btn-primary btn-sm">Ouvrir</Link>
          ) : (
            <>
              <Link to="/connexion" className="btn btn-link btn-sm">Connexion</Link>
              <Link to="/inscription" className="btn btn-primary btn-sm">S&apos;inscrire</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero" id="commencer">
        <h1>
          La messagerie pro,
          <br />
          en toute confidentialité.
        </h1>
        <p className="hero-lead">
          Messages, appels et fichiers — une seule application, pensée pour les équipes.
        </p>
        <div className="hero-actions">
          <Link to={user ? "/app" : "/inscription"} className="btn btn-primary">
            {user ? "Ouvrir Talkeo" : "Commencer"}
          </Link>
          {!user ? (
            <button
              type="button"
              className="btn btn-link"
              disabled={guestLoading}
              onClick={() => void tryDemo()}
            >
              {guestLoading ? "Chargement…" : "Voir la démo"}
            </button>
          ) : null}
        </div>
      </section>

      <section className="hero-visual" aria-hidden>
        <div className="hero-device">
          <div className="hero-device-screen">
            <div className="hero-device-sidebar" />
            <div className="hero-device-content">
              <div className="hero-device-line" />
              <div className="hero-device-line short" />
              <div className="hero-device-bubble" />
              <div className="hero-device-bubble mine" />
            </div>
          </div>
        </div>
      </section>

      <section className="feature-strip" id="produit" aria-label="Fonctionnalités">
        {FEATURES.map((f) => (
          <article key={f.title} className="feature-row">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </article>
        ))}
      </section>

      <section className="security-block" id="securite">
        <h2>Chiffrement de bout en bout.</h2>
        <p>
          Vos messages et fichiers sont chiffrés sur votre appareil avant tout envoi.
          Talkeo ne peut pas les lire.
        </p>
        <ul className="security-list">
          <li>AES-256-GCM</li>
          <li>Argon2id</li>
          <li>Vérification e-mail</li>
        </ul>
      </section>

      <section className="cta-minimal">
        <Link to="/inscription" className="btn btn-primary">
          Créer un compte
        </Link>
      </section>

      <footer className="marketing-footer">
        <span>© {new Date().getFullYear()} Talkeo</span>
        <nav className="footer-links" aria-label="Pied de page">
          <Link to="/connexion">Connexion</Link>
          <Link to="/inscription">Inscription</Link>
        </nav>
      </footer>
    </div>
  );
}
