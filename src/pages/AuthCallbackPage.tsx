import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogoWordmark } from "../components/Logo";

export function AuthCallbackPage() {
  const { confirmEmailFromAuthCallback, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/app", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const err = await confirmEmailFromAuthCallback();
      if (cancelled) return;
      if (err) {
        setError(err);
        return;
      }
      setDone(true);
      setTimeout(() => navigate("/connexion", { replace: true, state: { verified: true } }), 2000);
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmEmailFromAuthCallback, navigate, user]);

  return (
    <div className="page-center auth-callback-page">
      <div className="auth-card" style={{ maxWidth: 400, textAlign: "center" }}>
        <LogoWordmark />
        {error ? (
          <>
            <h1 style={{ marginTop: "1rem" }}>Lien invalide</h1>
            <p className="alert alert-error">{error}</p>
            <Link to="/verification-email" className="btn btn-primary btn-block">
              Saisir un code manuellement
            </Link>
          </>
        ) : done ? (
          <>
            <h1 style={{ marginTop: "1rem" }}>E-mail confirmé</h1>
            <p className="muted">Redirection vers la connexion…</p>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: "1.5rem auto" }} />
            <p className="muted">Validation de votre e-mail en cours…</p>
          </>
        )}
      </div>
    </div>
  );
}
