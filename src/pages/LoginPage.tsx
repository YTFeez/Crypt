import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";

export function LoginPage() {
  const { signIn, signInAsGuest, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const err = await signIn(email, password);
      if (err) setError(err);
      else navigate("/app", { replace: true });
    } catch {
      setError("Erreur inattendue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function onGuest() {
    setLoading(true);
    setError(null);
    try {
      const err = await signInAsGuest();
      if (err) setError(err);
      else navigate("/app", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <LogoWordmark light />
        <h2>Messagerie sécurisée pour votre équipe.</h2>
        <p>Connectez-vous pour accéder à vos conversations et dossiers.</p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <h1>Connexion</h1>
          <p className="subtitle">Entrez vos identifiants.</p>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: "0.5rem" }} disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: "0.65rem" }}
            disabled={loading}
            onClick={() => void onGuest()}
          >
            Explorer sans compte
          </button>
          <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.875rem", textAlign: "center" }}>
            Pas de compte ? <Link to="/inscription">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
