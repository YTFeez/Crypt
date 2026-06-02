import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { IconEye, IconEyeOff } from "../components/Icons";

export function LoginPage() {
  const { signIn, signInAsGuest, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const verifiedBanner = (location.state as { verified?: boolean } | null)?.verified;
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const err = await signIn(email.trim(), password);
      if (err) {
        setError(err);
      } else {
        navigate("/app", { replace: true });
      }
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
      subtitle="Accédez à votre espace Talkeo"
      footer={
        <p>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      }
    >
      {verifiedBanner ? (
        <div className="alert alert-success">
          E-mail confirmé. Vous pouvez vous connecter.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-error">
          {error}
          {error.toLowerCase().includes("vérifié") || error.toLowerCase().includes("verifie") ? (
            <p className="alert-action" style={{ marginTop: "0.5rem" }}>
              <Link to="/verification-email" state={{ email }}>
                Valider mon e-mail →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="login-email">Adresse e-mail</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Mot de passe</label>
          <div className="input-wrap">
            <input
              id="login-password"
              type={showPwd ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="input-eye"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Masquer" : "Afficher"}
            >
              {showPwd ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className={`btn btn-primary btn-block${loading ? " is-loading" : ""}`}
          disabled={loading}
        >
          <span className="btn-loading-inner">
            {loading ? <LoadingSpinner size="sm" /> : null}
            {loading ? "Connexion…" : "Se connecter"}
          </span>
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
        <span className="btn-loading-inner">
          {loading ? <LoadingSpinner size="sm" /> : null}
          Accès démo
        </span>
      </button>
      <p className="auth-hint">Compte préactivé — explorez Talkeo sans inscription.</p>
    </AuthLayout>
  );
}
