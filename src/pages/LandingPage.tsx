import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";
import { IconLock, IconMessage, IconUsers, IconPhone, IconFolder, IconBoard } from "../components/Icons";

export function LandingPage() {
  const { user, configured } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#securite">Sécurité</a>
          <a href="#commencer">Commencer</a>
        </nav>
        <div className="row" style={{ gap: "0.5rem" }}>
          {!configured ? (
            <Link to="/configuration" className="btn btn-secondary btn-sm">Configurer</Link>
          ) : user ? (
            <Link to="/app" className="btn btn-primary btn-sm">Ouvrir l'app</Link>
          ) : (
            <>
              <Link to="/connexion" className="btn btn-secondary btn-sm">Connexion</Link>
              <Link to="/inscription" className="btn btn-primary btn-sm">S'inscrire</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">
          <IconLock size={14} />
          Chiffrement de bout en bout
        </p>
        <h1>La messagerie pro.<br />Pensée pour les équipes.</h1>
        <p className="hero-lead">
          Messages, appels, dossiers et tableaux — une expérience fluide inspirée des meilleures
          interfaces, avec la sécurité que votre entreprise exige.
        </p>
        <div className="hero-actions" id="commencer">
          <Link to={user ? "/app" : "/inscription"} className="btn btn-primary">
            {user ? "Accéder à SecureHub" : "Créer un compte gratuit"}
          </Link>
          <Link to="/connexion" className="btn btn-secondary">Se connecter</Link>
        </div>
      </section>

      <section className="hero-mockup" aria-hidden>
        <div className="mockup-window">
          <div className="mockup-titlebar">
            <span className="mockup-dot" />
            <span className="mockup-dot" />
            <span className="mockup-dot" />
          </div>
          <div className="mockup-body">
            <div className="mockup-rail">
              <span className="active" />
              <span />
              <span />
              <span />
            </div>
            <div className="mockup-list">
              <div className="row active">
                <div className="mockup-avatar" />
                <div className="mockup-lines"><div className="l1" /><div className="l2" /></div>
              </div>
              <div className="row">
                <div className="mockup-avatar" style={{ background: "linear-gradient(135deg,#31a24c,#0866ff)" }} />
                <div className="mockup-lines"><div className="l1" /><div className="l2" /></div>
              </div>
              <div className="row">
                <div className="mockup-avatar" style={{ background: "linear-gradient(135deg,#e41e3f,#f7b928)" }} />
                <div className="mockup-lines"><div className="l1" /><div className="l2" /></div>
              </div>
            </div>
            <div className="mockup-chat">
              <div className="mockup-bubble them">Bonjour, le dossier Q2 est partagé.</div>
              <div className="mockup-bubble me">Parfait, je regarde tout de suite.</div>
              <div className="mockup-bubble them">Réunion à 15h — lien dans le groupe.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="bento" id="fonctionnalites" aria-label="Fonctionnalités">
        <article className="bento-card featured span-8">
          <div className="bento-icon"><IconMessage size={24} /></div>
          <h3>Messagerie instantanée</h3>
          <p>
            Conversations directes et groupes, pièces jointes, messages vocaux et notifications
            en temps réel — comme Messenger, pour le travail.
          </p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconLock size={24} /></div>
          <h3 id="securite">Sécurité Apple-grade</h3>
          <p>Chiffrement AES-GCM côté client. Vos clés ne quittent pas l'appareil.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconUsers size={24} /></div>
          <h3>Contacts & groupes</h3>
          <p>Réseau d'équipe, demandes d'ami et espaces départementaux.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconPhone size={24} /></div>
          <h3>Appels HD</h3>
          <p>Audio et visio intégrés pour vos réunions quotidiennes.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconFolder size={24} /></div>
          <h3>Dossiers cloud</h3>
          <p>Espaces personnels et dossiers communs avec droits granulaires.</p>
        </article>
        <article className="bento-card span-6">
          <div className="bento-icon"><IconBoard size={24} /></div>
          <h3>Tableaux collaboratifs</h3>
          <p>Brainstorming synchronisé en direct pour vos ateliers créatifs.</p>
        </article>
        <article className="bento-card span-6">
          <div className="bento-icon"><IconShield size={24} /></div>
          <h3>Prêt entreprise</h3>
          <p>Supabase, hébergement Hostinger, conformité et scalabilité.</p>
        </article>
      </section>

      <section className="cta-band">
        <h2>Prêt à transformer votre communication interne ?</h2>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>Déploiement en quelques minutes sur votre domaine.</p>
        <Link to="/inscription" className="btn btn-primary">Démarrer maintenant</Link>
      </section>

      <footer className="marketing-footer">
        <LogoWordmark />
        <span>© {new Date().getFullYear()} SecureHub · Veragrow</span>
        <span>Propulsé par Supabase</span>
      </footer>
    </div>
  );
}

function IconShield(props: { size?: number }) {
  return (
    <svg width={props.size ?? 24} height={props.size ?? 24} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.54-3.07 8.83-7 9.93-3.93-1.1-7-5.39-7-9.93v-5.7l7-3.12z" />
    </svg>
  );
}
