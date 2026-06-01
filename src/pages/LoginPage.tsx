import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";

export function LoginPage() {
  const { signIn, signInAsGuest, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const verifiedBanner = (location.state as { verified?: boolean } | null)?.verified;
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
    <AuthLayout
      badge="Accès sécurisé"
      brandTitle="Votre espace de travail confidentiel"
      brandDescription="Messagerie, dossiers partagés et studio créatif — conçus pour les équipes qui exigent discrétion et clarté."
      title="Connexion"
      subtitle="Identifiez-vous avec votre compte professionnel."
      footer={
        <p>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      }
    >
      {verifiedBanner ? (
        <div className="alert alert-success">E-mail confirmé. Vous pouvez vous connecter.</div>
      ) : null}
      {error ? (
        <div className="alert alert-error">
          {error}
          {error.includes("non vérifié") ? (
            <p className="alert-action">
              <Link to="/verification-email" state={{ email }}>
                Valider mon e-mail →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@entreprise.fr"
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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <div className="auth-divider">
        <span>ou</span>
      </div>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={loading}
        onClick={() => void onGuest()}
      >
        Parcourir la démo (compte vérifié)
      </button>
      <p className="auth-hint">La démo utilise un compte entreprise préactivé — sans inscription.</p>
    </AuthLayout>
  );
}
