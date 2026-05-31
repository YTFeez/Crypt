const KEY_STORAGE = "securehub-master-key-v1";

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function ensureMasterKey(password: string): Promise<void> {
  if (localStorage.getItem(KEY_STORAGE)) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const raw = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem(
    KEY_STORAGE,
    JSON.stringify({ salt: bufToB64(salt.buffer), key: bufToB64(raw) })
  );
}

async function loadMasterKey(): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) return null;
  try {
    const { key } = JSON.parse(raw) as { salt: string; key: string };
    return crypto.subtle.importKey("raw", b64ToBuf(key), "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch {
    return null;
  }
}

export async function encryptText(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await loadMasterKey();
  if (!key) return { ciphertext: plain, iv: "" };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return { ciphertext: bufToB64(cipher), iv: bufToB64(iv.buffer) };
}

export async function decryptText(ciphertext: string, iv: string): Promise<string> {
  if (!iv) return ciphertext;
  const key = await loadMasterKey();
  if (!key) return "[chiffrement non initialisé]";
  try {
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64ToBuf(iv)) }, key, b64ToBuf(ciphertext));
    return new TextDecoder().decode(dec);
  } catch {
    return "[message illisible]";
  }
}

export function clearMasterKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}
