/** Entropie cryptographique — fonctionne en HTTP (getRandomValues) et HTTPS */

export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
    return buf;
  }
  throw new Error("Générateur aléatoire indisponible dans ce navigateur.");
}

/** UUID v4 (RFC 4122) — remplace crypto.randomUUID (absent hors contexte sécurisé) */
export function randomUuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
