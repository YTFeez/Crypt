import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { VERIFICATION_FROM_EMAIL } from "../lib/email-verify";

type LocationState = { email?: string; devCode?: string };

export function VerifyEmailPage() {
  const { user, verifyEmailWithCode, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [email, setEmail] = useState(state.email ?? "");
  const [code, setCode] = useState(state.devCode ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    state.devCode ? `Mode développement — code : ${state.devCode}` : null
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const err = await verifyEmailWithCode(email, code, password);
      if (err) setError(err);
      else navigate("/app", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email.trim()) {
      setError("Indiquez votre adresse e-mail.");
      return;
    }
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await resendVerificationEmail(email);
      if (res.error) setError(res.error);
      else {
        setInfo(
          res.devCode
            ? `Nouveau code (développement) : ${res.devCode}`
            : `Un nouvel e-mail a été envoyé depuis ${VERIFICATION_FROM_EMAIL}. Vérifiez vos spams.`
        );
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      badge="Vérification obligatoire"
      brandTitle="Protégez l'accès à votre organisation"
      brandDescription="Sans e-mail vérifié, aucune donnée (messages, fichiers, studio) n'est accessible — même en cas de mot de passe correct."
      title="Confirmer votre e-mail"
      subtitle={`Étape 2 — code envoyé depuis ${VERIFICATION_FROM_EMAIL}`}
      footer={
        <p>
          <Link to="/connexion">Retour à la connexion</Link>
        </p>
      }
    >
      <div className="verify-steps" aria-label="Progression">
        <span className="done">Compte créé</span>
        <span className="active">Vérification</span>
        <span>Accès app</span>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-info">{info}</div> : null}
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field">
          <label htmlFor="vemail">E-mail</label>
          <input
            id="vemail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
          />
        </div>
        <div className="field">
          <label htmlFor="vcode">Code à 6 chiffres</label>
          <input
            id="vcode"
            className="input-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
        <div className="field">
          <label htmlFor="vpassword">Mot de passe d&apos;inscription</label>
          <input
            id="vpassword"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className={`btn btn-primary btn-block${loading ? " is-loading" : ""}`} disabled={loading}>
          <span className="btn-loading-inner">
            {loading ? <LoadingSpinner size="sm" /> : null}
            {loading ? "Activation…" : "Activer mon compte"}
          </span>
        </button>
      </form>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        disabled={resending}
        onClick={() => void onResend()}
      >
        {resending ? "Envoi…" : "Renvoyer le code"}
      </button>
    </AuthLayout>
  );
}
