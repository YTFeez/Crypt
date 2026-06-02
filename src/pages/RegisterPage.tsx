import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function RegisterPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
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
      const result = await signUp(email.trim(), password, displayName.trim());
      if (!result.ok) {
        setError(result.error ?? "Erreur lors de l'inscription.");
      } else if (result.needsVerification) {
        navigate("/verification-email", {
          replace: true,
          state: { email: result.email, devCode: result.devCode },
        });
      } else {
        navigate("/app", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      badge="Inscription"
      brandTitle="Rejoignez votre équipe sur Talkeo"
      brandDescription="Créez un compte sécurisé. L'accès à l'application est ouvert uniquement après validation de votre adresse e-mail."
      title="Créer un compte"
      subtitle="Étape 1 — identité et accès"
      footer={
        <p>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
        </p>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <form onSubmit={onSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="reg-name">Nom complet</label>
          <input
            id="reg-name"
            required
            autoComplete="name"
            placeholder="Jean Dupont"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="reg-email">Adresse e-mail</label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="reg-password">Mot de passe</label>
          <div className="input-wrap">
            <input
              id="reg-password"
              type={showPwd ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8 caractères minimum, lettre + chiffre"
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
              {showPwd ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <p className="auth-legal">
          Un code de vérification vous sera envoyé — l&apos;accès reste bloqué tant que
          l&apos;e-mail n&apos;est pas confirmé.
        </p>

        <button
          type="submit"
          className={`btn btn-primary btn-block${loading ? " is-loading" : ""}`}
          disabled={loading}
        >
          <span className="btn-loading-inner">
            {loading ? <LoadingSpinner size="sm" /> : null}
            {loading ? "Création du compte…" : "Continuer →"}
          </span>
        </button>
      </form>
    </AuthLayout>
  );
}
