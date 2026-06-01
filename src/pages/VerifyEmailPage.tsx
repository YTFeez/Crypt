import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";

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
            : "Un nouvel e-mail de vérification a été envoyé."
        );
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-brand-panel">
        <LogoWordmark light />
        <h2>Vérifiez votre e-mail</h2>
        <p>
          Nous avons envoyé un code à 6 chiffres (ou un lien si Supabase est configuré). Saisissez-le
          ci-dessous avec votre mot de passe pour activer le compte.
        </p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <h1>Confirmation</h1>
          <p className="subtitle">Code reçu par e-mail</p>
          {error ? <div className="alert alert-error">{error}</div> : null}
          {info ? <div className="alert alert-info">{info}</div> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="vemail">E-mail</label>
              <input
                id="vemail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="vcode">Code à 6 chiffres</label>
              <input
                id="vcode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="field">
              <label htmlFor="vpassword">Mot de passe (créé à l&apos;inscription)</label>
              <input
                id="vpassword"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Vérification…" : "Valider mon compte"}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: "0.5rem" }}
            disabled={resending}
            onClick={() => void onResend()}
          >
            {resending ? "Envoi…" : "Renvoyer le code / l'e-mail"}
          </button>
          <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.875rem", textAlign: "center" }}>
            <Link to="/connexion">Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
