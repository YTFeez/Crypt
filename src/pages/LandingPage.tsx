import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";
import {
  IconLock,
  IconMessage,
  IconUsers,
  IconPhone,
  IconFolder,
  IconBoard,
  IconShield,
} from "../components/Icons";

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
          {user ? (
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
        <h1>Talkeo.<br />La messagerie pro pour les équipes.</h1>
        <p className="hero-lead">
          Messages, appels, dossiers et tableaux — une expérience fluide inspirée des meilleures
          interfaces, avec la sécurité que votre entreprise exige.
        </p>
        <div className="hero-actions" id="commencer">
          <Link to={user ? "/app" : "/inscription"} className="btn btn-primary">
            {user ? "Ouvrir Talkeo" : "Créer un compte gratuit"}
          </Link>
          {!user ? (
            <button type="button" className="btn btn-secondary" disabled={guestLoading} onClick={() => void tryDemo()}>
              {guestLoading ? "Chargement…" : "Explorer la démo"}
            </button>
          ) : null}
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
                <div className="mockup-avatar" style={{ background: "linear-gradient(135deg,#06b6d4,#7c3aed)" }} />
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
            en temps réel. Chiffrement de bout en bout sur chaque échange.
          </p>
        </article>
        <article className="bento-card span-4" id="securite">
          <div className="bento-icon"><IconLock size={24} /></div>
          <h3>Sécurité renforcée</h3>
          <p>Coffre chiffré AES-256. Seuls les membres autorisés peuvent lire vos données.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconUsers size={24} /></div>
          <h3>Contacts et groupes</h3>
          <p>Réseau d'équipe, demandes de contact et espaces départementaux dédiés.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconPhone size={24} /></div>
          <h3>Appels intégrés</h3>
          <p>Audio et visioconférence HD pour vos réunions quotidiennes, sans application tierce.</p>
        </article>
        <article className="bento-card span-4">
          <div className="bento-icon"><IconFolder size={24} /></div>
          <h3>Dossiers partagés</h3>
          <p>Espaces personnels et dossiers communs avec droits d'accès granulaires par membre.</p>
        </article>
        <article className="bento-card span-6">
          <div className="bento-icon"><IconBoard size={24} /></div>
          <h3>Studio de création</h3>
          <p>Affiches, posts réseaux sociaux et présentations — entièrement intégré à Talkeo.</p>
        </article>
        <article className="bento-card span-6">
          <div className="bento-icon"><IconShield size={24} /></div>
          <h3>Prêt pour l'entreprise</h3>
          <p>Gestion des accès, espaces d'équipe et conformité pour votre organisation.</p>
        </article>
      </section>

      <section className="features-detail">
        <div className="features-detail-inner">
          <div className="features-detail-text">
            <p className="features-eyebrow">Sécurité</p>
            <h2>Votre confidentialité n'est pas négociable.</h2>
            <p>
              Talkeo chiffre l'intégralité de vos données côté client avant tout envoi au serveur.
              Vos messages, fichiers et créations ne peuvent être lus que par vous et vos
              destinataires — jamais par Talkeo ni par un tiers.
            </p>
            <ul className="features-list">
              <li>Chiffrement AES-256-GCM de bout en bout</li>
              <li>Dérivation de clé Argon2id — résistant aux attaques par force brute</li>
              <li>Aucune donnée en clair stockée côté serveur</li>
              <li>Vérification d'e-mail obligatoire à l'inscription</li>
            </ul>
          </div>
          <div className="features-detail-visual">
            <div className="security-card">
              <div className="security-icon">
                <IconShield size={32} />
              </div>
              <p className="security-label">Chiffrement actif</p>
              <div className="security-bars">
                <div className="bar" style={{ width: "100%", background: "var(--primary)" }} />
                <div className="bar" style={{ width: "85%", background: "#6366f1" }} />
                <div className="bar" style={{ width: "70%", background: "#0d9488" }} />
              </div>
              <p className="security-caption">AES-256-GCM · Argon2id · E2E</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Prêt à transformer votre communication interne ?</h2>
        <p>Rejoignez des équipes qui font confiance à Talkeo pour leurs échanges confidentiels.</p>
        <Link to="/inscription" className="btn btn-primary">Démarrer gratuitement</Link>
      </section>

      <footer className="marketing-footer">
        <LogoWordmark />
        <nav className="footer-links" aria-label="Liens pied de page">
          <Link to="/connexion">Connexion</Link>
          <Link to="/inscription">Inscription</Link>
        </nav>
        <span>© {new Date().getFullYear()} Talkeo — Communication sécurisée</span>
      </footer>
    </div>
  );
}
