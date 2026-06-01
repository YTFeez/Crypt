import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";

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
    <div className="auth-split">
      <div className="auth-brand-panel">
        <LogoWordmark light />
        <h2>Rejoignez Talkeo.</h2>
        <p>Créez votre compte et échangez en toute confidentialité avec votre équipe.</p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <h1>Inscription</h1>
          <p className="subtitle">C'est rapide et gratuit pour commencer.</p>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">Nom et prénom</label>
              <input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail professionnel</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
              Un code de vérification sera envoyé à votre adresse e-mail avant la première connexion.
            </p>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Création du compte…" : "S'inscrire"}
            </button>
          </form>
          <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.875rem", textAlign: "center" }}>
            Déjà membre ? <Link to="/connexion">Connexion</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
