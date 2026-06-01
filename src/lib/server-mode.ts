/** Mode VPS Hostinger : données sur l'API Talkeo (SQLite sur le serveur) */
export function isServerMode(): boolean {
  const url = (import.meta.env.VITE_API_URL ?? "").trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

export function getApiUrl(): string {
  return (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
}
