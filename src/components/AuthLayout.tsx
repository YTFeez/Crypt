import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogoWordmark } from "./Logo";
import { ParticleNetwork } from "./ParticleNetwork";

type Props = {
  title: string;
  subtitle: string;
  brandTitle: string;
  brandDescription: string;
  children: ReactNode;
  badge?: string;
  footer?: ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  brandTitle,
  brandDescription,
  children,
  badge,
  footer,
}: Props) {
  return (
    <div className="auth-page">
      <aside className="auth-aside" aria-hidden={false}>
        <ParticleNetwork variant="dark" />
        <div className="auth-aside-inner">
          <Link to="/" className="auth-home-link">
            <LogoWordmark light />
          </Link>
          {badge ? <span className="auth-aside-badge">{badge}</span> : null}
          <h2>{brandTitle}</h2>
          <p>{brandDescription}</p>
          <ul className="auth-trust-list">
            <li>Chiffrement de bout en bout</li>
            <li>Espace de travail entreprise</li>
            <li>Conformité et contrôle d&apos;accès</li>
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <ParticleNetwork variant="light" />
        <div className="auth-card-pro">
          <header className="auth-card-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
          {footer ? <footer className="auth-card-footer">{footer}</footer> : null}
        </div>
      </main>
    </div>
  );
}
