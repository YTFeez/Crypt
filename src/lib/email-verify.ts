import { sha256B64 } from "./crypto";

export const VERIFICATION_FROM_EMAIL = "support@talkeo.fr";
export const VERIFICATION_FROM_NAME = "Talkeo";

const CODE_TTL_MS = 15 * 60 * 1000;

export type PendingVerification = {
  email: string;
  codeHash: string;
  expiresAt: number;
  userId: string;
};

const PENDING_KEY = "crypt-email-pending-v1";

export function generateVerificationCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  return sha256B64(code.trim());
}

export function savePendingVerification(pending: PendingVerification) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingVerification(): PendingVerification | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingVerification;
    if (!p.email || !p.codeHash || !p.userId) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingVerification() {
  localStorage.removeItem(PENDING_KEY);
}

export function createPendingVerification(email: string, userId: string, code: string): PendingVerification {
  const pending: PendingVerification = {
    email: email.trim().toLowerCase(),
    userId,
    codeHash: hashVerificationCode(code),
    expiresAt: Date.now() + CODE_TTL_MS,
  };
  savePendingVerification(pending);
  return pending;
}

export function verifyCodeAgainstPending(email: string, code: string): { ok: true; userId: string } | { ok: false; error: string } {
  const pending = getPendingVerification();
  const norm = email.trim().toLowerCase();
  if (!pending || pending.email !== norm) {
    return { ok: false, error: "Aucune vérification en cours pour cet e-mail. Réinscrivez-vous ou renvoyez le code." };
  }
  if (Date.now() > pending.expiresAt) {
    clearPendingVerification();
    return { ok: false, error: "Le code a expiré (15 min). Demandez un nouveau code." };
  }
  if (hashVerificationCode(code) !== pending.codeHash) {
    return { ok: false, error: "Code incorrect. Vérifiez les 6 chiffres reçus par e-mail." };
  }
  clearPendingVerification();
  return { ok: true, userId: pending.userId };
}

function getVerificationEndpoint(): string {
  const explicit = (import.meta.env.VITE_VERIFICATION_EMAIL_URL ?? "").trim();
  if (explicit) return explicit;
  const api = (import.meta.env.VITE_API_URL ?? "").trim();
  if (api) return `${api.replace(/\/$/, "")}/api/send-verification`;
  return "";
}

/** Envoie le code via l'API Talkeo (depuis support@talkeo.fr) ou webhook personnalisé */
export async function sendVerificationEmail(
  email: string,
  code: string,
  displayName: string,
  purpose: "verification" | "email-change" = "verification"
): Promise<{ sent: boolean; devCode?: string }> {
  const endpoint = getVerificationEndpoint();
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          displayName,
          purpose,
          from: VERIFICATION_FROM_EMAIL,
          fromName: VERIFICATION_FROM_NAME,
          app: "Talkeo",
          subject:
            purpose === "email-change"
              ? "Confirmez votre nouvel e-mail — Talkeo"
              : "Votre code de vérification Talkeo",
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { devCode?: string; sent?: boolean };
        return { sent: body.sent !== false, devCode: body.devCode };
      }
    } catch (e) {
      console.warn("[Talkeo] envoi e-mail", e);
    }
  }
  if (import.meta.env.DEV) {
    console.info(`[Talkeo] Code (${VERIFICATION_FROM_EMAIL}) pour ${email}: ${code}`);
    return { sent: false, devCode: code };
  }
  return { sent: false };
}
