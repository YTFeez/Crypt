import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LoadingScreen } from "../components/LoadingScreen";

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

  if (!error && !done) {
    return <LoadingScreen label="Validation de votre e-mail…" />;
  }

  return (
    <div className="page-center auth-callback-page">
      <div className="auth-card-pro" style={{ maxWidth: 400, textAlign: "center" }}>
        {error ? (
          <>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem" }}>Lien invalide</h1>
            <p className="alert alert-error">{error}</p>
            <Link to="/verification-email" className="btn btn-primary btn-block" style={{ marginTop: "1rem" }}>
              Saisir un code manuellement
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.35rem" }}>E-mail confirmé</h1>
            <p className="muted">Redirection vers la connexion…</p>
          </>
        )}
      </div>
    </div>
  );
}
