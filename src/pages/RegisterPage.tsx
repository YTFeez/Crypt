import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";

export function RegisterPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
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
      const result = await signUp(email, password, displayName);
      if (!result.ok) setError(result.error);
      else if (result.needsVerification) {
        navigate("/verification-email", {
          replace: true,
          state: { email: result.email, devCode: result.devCode },
        });
      } else navigate("/app", { replace: true });
    } catch {
      setError("Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      badge="Inscription entreprise"
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
          <label htmlFor="name">Nom complet</label>
          <input
            id="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jean Dupont"
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail professionnel</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 caractères minimum"
            autoComplete="new-password"
          />
        </div>
        <p className="auth-legal">
          En continuant, vous confirmez disposer d&apos;une adresse e-mail professionnelle valide. Un code de
          vérification vous sera envoyé — l&apos;application reste inaccessible tant que l&apos;e-mail n&apos;est pas
          confirmé.
        </p>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? "Création…" : "Continuer"}
        </button>
      </form>
    </AuthLayout>
  );
}
