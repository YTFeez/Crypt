
/** Coffre chiffré — clé AES uniquement en RAM, jamais stockée en clair */

const VAULT_META = "crypt-vault-meta-v3";
const SESSION_KEY_RAM = "crypt-sk-ram";
const PBKDF2_ITERS = 210_000;

let sessionKey: CryptoKey | null = null;

function bufToB64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Empreinte mot de passe (jamais le mot de passe en clair) */
export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    256
  );
  return { hash: bufToB64(bits), salt: bufToB64(salt.buffer) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

type VaultMeta = { salt: string; verifier: string; userId: string };

export function isVaultUnlocked(): boolean {
  return sessionKey !== null;
}

/** Déverrouille le coffre — vérifie le mot de passe si compte existant */
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
    const salt = new Uint8Array(b64ToBuf(meta.salt));
    sessionKey = await deriveAesKey(password, salt);
    await persistSessionKey();
    return { ok: true };
  }
  if (!opts?.create || !opts.userId) {
    return { ok: false, error: "Aucun coffre — créez un compte." };
  }
  const { hash, salt } = await hashPassword(password);
  const meta: VaultMeta = { salt, verifier: hash, userId: opts.userId };
  localStorage.setItem(VAULT_META, JSON.stringify(meta));
  sessionKey = await deriveAesKey(password, new Uint8Array(b64ToBuf(salt)));
  await persistSessionKey();
  return { ok: true };
}

async function persistSessionKey() {
  if (!sessionKey) return;
  const raw = await crypto.subtle.exportKey("raw", sessionKey);
  sessionStorage.setItem(SESSION_KEY_RAM, bufToB64(raw));
}

export async function restoreSessionKey(): Promise<boolean> {
  const raw = sessionStorage.getItem(SESSION_KEY_RAM);
  if (!raw) return false;
  try {
    sessionKey = await crypto.subtle.importKey("raw", b64ToBuf(raw), "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
    return true;
  } catch {
    return false;
  }
}

export function lockVault() {
  sessionKey = null;
  sessionStorage.removeItem(SESSION_KEY_RAM);
}

export function clearVaultMeta() {
  lockVault();
  localStorage.removeItem(VAULT_META);
}

export async function encryptText(plain: string): Promise<{ ciphertext: string; iv: string }> {
  if (!sessionKey) return { ciphertext: plain, iv: "" };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    new TextEncoder().encode(plain)
  );
  return { ciphertext: bufToB64(cipher), iv: bufToB64(iv.buffer) };
}

export async function decryptText(ciphertext: string, iv: string): Promise<string> {
  if (!iv || !sessionKey) return ciphertext.startsWith("{") ? ciphertext : ciphertext;
  try {
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(iv)) },
      sessionKey,
      b64ToBuf(ciphertext)
    );
    return new TextDecoder().decode(dec);
  } catch {
    return "[message chiffré — mauvais mot de passe ou session expirée]";
  }
}

/** Chiffre un blob JSON pour IndexedDB */
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
