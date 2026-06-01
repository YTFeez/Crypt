import { gcm } from "@noble/ciphers/aes.js";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "./secure-random";

/**
 * Coffre zero-knowledge côté client
 * — KDF : Argon2id (RFC 9106, résistant GPU/ASIC)
 * — Chiffrement : AES-256-GCM (authentifié)
 * — HTTPS : Web Crypto matériel ; HTTP : @noble (même algorithmes)
 */

const VAULT_META_KEY = "crypt-vault-meta-v4";
const VAULT_META_LEGACY = "crypt-vault-meta-v3";
const SESSION_KEY_RAM = "crypt-sk-ram";

/** OWASP / RFC 9106 — coût élevé mais utilisable dans le navigateur */
const ARGON2 = { t: 3, m: 12288, p: 1, dkLen: 32 } as const;
const PBKDF2_ITERS_LEGACY = 210_000;

type KdfAlg = "argon2id" | "pbkdf2";
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
  return (
    !window.isSecureContext &&
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1"
  );
}

export function getCryptoProfile(): {
  kdf: string;
  cipher: string;
  secureContext: boolean;
  backend: "webcrypto" | "noble";
} {
  return {
    kdf: "Argon2id",
    cipher: "AES-256-GCM",
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    backend: useSubtle ? "webcrypto" : "noble",
  };
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readVaultMetaRaw(): string | null {
  return localStorage.getItem(VAULT_META_KEY) ?? localStorage.getItem(VAULT_META_LEGACY);
}

function writeVaultMeta(meta: VaultMeta) {
  localStorage.removeItem(VAULT_META_LEGACY);
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

async function deriveArgon2Key(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const pass = new TextEncoder().encode(password);
  return argon2idAsync(pass, salt, { ...ARGON2 });
}

function derivePbkdf2Legacy(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(password), salt, {
    c: PBKDF2_ITERS_LEGACY,
    dkLen: 32,
  });
}

async function deriveMasterKey(
  password: string,
  salt: Uint8Array,
  kdf: KdfAlg
): Promise<Uint8Array> {
  if (kdf === "argon2id") return deriveArgon2Key(password, salt);
  if (useSubtle) {
    const enc = new TextEncoder();
    const base = await crypto.subtle!.importKey("raw", enc.encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    const bits = await crypto.subtle!.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERS_LEGACY, hash: "SHA-256" },
      base,
      256
    );
    return new Uint8Array(bits);
  }
  return derivePbkdf2Legacy(password, salt);
}

async function deriveSubtleAesKey(master: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle!.importKey("raw", master, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function deriveSession(password: string, salt: Uint8Array, kdf: KdfAlg): Promise<Session> {
  const master = await deriveMasterKey(password, salt, kdf);
  if (useSubtle) return { mode: "subtle", key: await deriveSubtleAesKey(master) };
  return { mode: "noble", key: master };
}

export async function hashPassword(
  password: string,
  saltB64?: string
): Promise<{ hash: string; salt: string; kdf: KdfAlg }> {
  const salt = saltB64 ? b64ToU8(saltB64) : randomBytes(16);
  const key = await deriveArgon2Key(password, salt);
  return { hash: bufToB64(key), salt: bufToB64(salt), kdf: "argon2id" };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
  kdf: KdfAlg = "argon2id"
): Promise<boolean> {
  const derived = await deriveMasterKey(password, b64ToU8(salt), kdf);
  return timingSafeEqual(bufToB64(derived), expectedHash);
}

type VaultMeta = {
  salt: string;
  verifier: string;
  userId: string;
  kdf?: KdfAlg;
  v?: number;
};

export function isVaultUnlocked(): boolean {
  return session !== null;
}

async function upgradeVaultKdf(meta: VaultMeta, password: string): Promise<VaultMeta> {
  if (meta.kdf === "argon2id" && meta.v === 4) return meta;
  const cred = await hashPassword(password);
  const upgraded: VaultMeta = {
    salt: cred.salt,
    verifier: cred.hash,
    userId: meta.userId,
    kdf: "argon2id",
    v: 4,
  };
  writeVaultMeta(upgraded);
  return upgraded;
}

export async function unlockVault(
  password: string,
  opts?: { userId?: string; create?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const raw = readVaultMetaRaw();
  if (raw) {
    let meta = JSON.parse(raw) as VaultMeta;
    if (opts?.userId && meta.userId !== opts.userId) {
      return { ok: false, error: "Session d'un autre compte. Déconnectez-vous d'abord." };
    }
    const kdf: KdfAlg = meta.kdf ?? "pbkdf2";
    const valid = await verifyPassword(password, meta.salt, meta.verifier, kdf);
    if (!valid) return { ok: false, error: "Mot de passe incorrect." };
    meta = await upgradeVaultKdf(meta, password);
    session = await deriveSession(password, b64ToU8(meta.salt), "argon2id");
    await persistSessionKey();
    return { ok: true };
  }
  if (!opts?.create || !opts.userId) {
    return { ok: false, error: "Aucun coffre — créez un compte." };
  }
  const { hash, salt } = await hashPassword(password);
  const meta: VaultMeta = { salt, verifier: hash, userId: opts.userId, kdf: "argon2id", v: 4 };
  writeVaultMeta(meta);
  session = await deriveSession(password, b64ToU8(salt), "argon2id");
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
  localStorage.removeItem(VAULT_META_KEY);
  localStorage.removeItem(VAULT_META_LEGACY);
}

/** Hachage SHA-256 (anciens comptes) — sans Web Crypto */
export function sha256B64(input: string): string {
  const h = sha256(new TextEncoder().encode(input));
  return bufToB64(h);
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
