import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

/** Coffre chiffré — Web Crypto (HTTPS) ou @noble (HTTP de secours) */

const VAULT_META = "crypt-vault-meta-v3";
const SESSION_KEY_RAM = "crypt-sk-ram";
const PBKDF2_ITERS = 210_000;

const useSubtle = typeof crypto !== "undefined" && Boolean(crypto.subtle);

type Session =
  | { mode: "subtle"; key: CryptoKey }
  | { mode: "noble"; key: Uint8Array };

let session: Session | null = null;

export function usesFallbackCrypto(): boolean {
  return !useSubtle;
}

export function isHttpsRecommended(): boolean {
  if (typeof window === "undefined") return false;
  return !window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function randomBytes(n: number): Uint8Array {
  const u8 = new Uint8Array(n);
  crypto.getRandomValues(u8);
  return u8;
}

async function deriveSubtleKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle!.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle!.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function deriveNobleKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(password), salt, { c: PBKDF2_ITERS, dkLen: 32 });
}

async function deriveSession(password: string, salt: Uint8Array): Promise<Session> {
  if (useSubtle) return { mode: "subtle", key: await deriveSubtleKey(password, salt) };
  return { mode: "noble", key: deriveNobleKey(password, salt) };
}

export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? b64ToU8(saltB64) : randomBytes(16);
  if (useSubtle) {
    const enc = new TextEncoder();
    const base = await crypto.subtle!.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle!.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      base,
      256
    );
    return { hash: bufToB64(bits), salt: bufToB64(salt) };
  }
  const key = deriveNobleKey(password, salt);
  return { hash: bufToB64(key), salt: bufToB64(salt) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

type VaultMeta = { salt: string; verifier: string; userId: string };

export function isVaultUnlocked(): boolean {
  return session !== null;
}

export async function unlockVault(
  password: string,
  opts?: { userId?: string; create?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const raw = localStorage.getItem(VAULT_META);
  if (raw) {
    const meta = JSON.parse(raw) as VaultMeta;
    if (opts?.userId && meta.userId !== opts.userId) {
      return { ok: false, error: "Session d'un autre compte. Déconnectez-vous d'abord." };
    }
    const valid = await verifyPassword(password, meta.salt, meta.verifier);
    if (!valid) return { ok: false, error: "Mot de passe incorrect." };
    session = await deriveSession(password, b64ToU8(meta.salt));
    await persistSessionKey();
    return { ok: true };
  }
  if (!opts?.create || !opts.userId) {
    return { ok: false, error: "Aucun coffre — créez un compte." };
  }
  const { hash, salt } = await hashPassword(password);
  const meta: VaultMeta = { salt, verifier: hash, userId: opts.userId };
  localStorage.setItem(VAULT_META, JSON.stringify(meta));
  session = await deriveSession(password, b64ToU8(salt));
  await persistSessionKey();
  return { ok: true };
}

async function persistSessionKey() {
  if (!session) return;
  if (session.mode === "subtle") {
    const raw = await crypto.subtle!.exportKey("raw", session.key);
    sessionStorage.setItem(SESSION_KEY_RAM, `s:${bufToB64(raw)}`);
  } else {
    sessionStorage.setItem(SESSION_KEY_RAM, `n:${bufToB64(session.key)}`);
  }
}

export async function restoreSessionKey(): Promise<boolean> {
  const raw = sessionStorage.getItem(SESSION_KEY_RAM);
  if (!raw) return false;
  try {
    if (raw.startsWith("s:") && useSubtle) {
      session = {
        mode: "subtle",
        key: await crypto.subtle!.importKey("raw", b64ToU8(raw.slice(2)), "AES-GCM", false, [
          "encrypt",
          "decrypt",
        ]),
      };
      return true;
    }
    if (raw.startsWith("n:")) {
      session = { mode: "noble", key: b64ToU8(raw.slice(2)) };
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function lockVault() {
  session = null;
  sessionStorage.removeItem(SESSION_KEY_RAM);
}

export function clearVaultMeta() {
  lockVault();
  localStorage.removeItem(VAULT_META);
}

export async function encryptText(plain: string): Promise<{ ciphertext: string; iv: string }> {
  if (!session) return { ciphertext: plain, iv: "" };
  const data = new TextEncoder().encode(plain);

  if (session.mode === "subtle") {
    const iv = randomBytes(12);
    const cipher = await crypto.subtle!.encrypt({ name: "AES-GCM", iv }, session.key, data);
    return { ciphertext: bufToB64(cipher), iv: bufToB64(iv) };
  }

  const iv = randomBytes(12);
  const aes = gcm(session.key, iv);
  const cipher = aes.encrypt(data);
  return { ciphertext: bufToB64(cipher), iv: bufToB64(iv) };
}

export async function decryptText(ciphertext: string, iv: string): Promise<string> {
  if (!iv || !session) return ciphertext;
  try {
    if (session.mode === "subtle") {
      const dec = await crypto.subtle!.decrypt(
        { name: "AES-GCM", iv: b64ToU8(iv) },
        session.key,
        b64ToU8(ciphertext)
      );
      return new TextDecoder().decode(dec);
    }
    const aes = gcm(session.key, b64ToU8(iv));
    const dec = aes.decrypt(b64ToU8(ciphertext));
    return new TextDecoder().decode(dec);
  } catch {
    return "[message chiffré — session expirée ou mauvais mot de passe]";
  }
}

export async function encryptPayload(obj: unknown): Promise<{ data: string; iv: string }> {
  const { ciphertext, iv } = await encryptText(JSON.stringify(obj));
  return { data: ciphertext, iv };
}

export async function decryptPayload<T>(data: string, iv: string): Promise<T | null> {
  if (!iv) {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  const plain = await decryptText(data, iv);
  try {
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}
