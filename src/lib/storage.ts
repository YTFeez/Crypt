/**
 * IndexedDB — un coffre par utilisateur (évite les conflits à l'inscription)
 */
import { decryptPayload, encryptPayload } from "./crypto";

const DB_NAME = "crypt-store";
const STORE = "vault";
export const SHARED_VAULT_ID = "__shared__";

type VaultPayload = Record<string, unknown>;

const cache = new Map<string, VaultPayload>();
let dbp: Promise<IDBDatabase> | null = null;

function vaultKey(userId: string) {
  return `v-${userId}`;
}

function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponible"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
  return dbp;
}

async function idbGet(userId: string): Promise<{ data: string; iv: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(vaultKey(userId));
    req.onsuccess = () => resolve((req.result as { data: string; iv: string }) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(userId: string, payload: { data: string; iv: string }) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, vaultKey(userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function migrateLegacyStorage(): Promise<void> {
  const legacy = localStorage.getItem("crypt-db-v1");
  if (!legacy) return;
  if ((await idbGet(SHARED_VAULT_ID)) !== null) {
    localStorage.removeItem("crypt-db-v1");
    return;
  }
  try {
    const parsed = JSON.parse(legacy);
    await saveVault(SHARED_VAULT_ID, parsed, true);
    localStorage.removeItem("crypt-db-v1");
  } catch {
    /* ignore */
  }
}

export async function loadVault<T extends VaultPayload>(userId: string): Promise<T> {
  const hit = cache.get(userId);
  if (hit) return hit as T;

  const row = await idbGet(userId);
  if (!row) return {} as T;

  const data = await decryptPayload<T>(row.data, row.iv);
  const merged = (data ?? {}) as VaultPayload;
  cache.set(userId, merged);
  return merged as T;
}

/** plain=true : seed initial sans clé de session */
export async function saveVault(userId: string, data: VaultPayload, plain = false): Promise<void> {
  cache.set(userId, data);
  if (plain) {
    await idbSet(userId, { data: JSON.stringify(data), iv: "" });
    return;
  }
  const enc = await encryptPayload(data);
  await idbSet(userId, enc);
}

export function invalidateVaultCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function patchVault(userId: string, mutate: (data: VaultPayload) => void): Promise<void> {
  const data = { ...(await loadVault(userId)) };
  mutate(data);
  await saveVault(userId, data);
}
