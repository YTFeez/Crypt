import { Link } from "react-router-dom";
import { LogoWordmark } from "../components/Logo";

export function SetupPage() {
  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <LogoWordmark light />
        <h2>Connectez votre backend Supabase.</h2>
        <p>Une fois configuré, déployez sur Hostinger en un clic depuis GitHub.</p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card" style={{ maxWidth: 480 }}>
          <h1>Configuration</h1>
          <p className="subtitle">Étapes pour activer SecureHub.</p>
          <div className="alert alert-info">
            Copiez <code>.env.example</code> vers <code>.env</code> avec vos clés Supabase.
          </div>
          <ol className="stack muted" style={{ fontSize: "0.9rem", paddingLeft: "1.25rem", margin: 0 }}>
            <li>Projet sur <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com</a></li>
            <li>SQL : <code>supabase/migrations/001_initial_schema.sql</code></li>
            <li>Realtime : tables messages, boards, calls</li>
            <li>Variables <code>VITE_SUPABASE_*</code> dans Hostinger</li>
          </ol>
          <Link to="/" className="btn btn-secondary" style={{ marginTop: "1.5rem" }}>
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
