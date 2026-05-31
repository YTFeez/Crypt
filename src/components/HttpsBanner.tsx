import { isHttpsRecommended } from "../lib/crypto";

export function HttpsBanner() {
  if (!isHttpsRecommended()) return null;

  const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;

  return (
    <div
      className="alert alert-info"
      style={{
        margin: 0,
        borderRadius: 0,
        textAlign: "center",
        fontSize: "0.85rem",
        padding: "0.65rem 1rem",
      }}
      role="status"
    >
      Connexion non sécurisée (HTTP). Pour une protection maximale, utilisez{" "}
      <a href={httpsUrl} style={{ fontWeight: 600 }}>
        HTTPS
      </a>
      . L&apos;inscription fonctionne quand même avec chiffrement de secours.
    </div>
  );
}
