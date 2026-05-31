/**
 * Stockage IndexedDB — une seule entrée chiffrée, charge/sauve garde minimales en RAM
 */
import { decryptPayload, encryptPayload } from "./crypto";

const DB_NAME = "crypt-store";
const STORE = "vault";
const KEY = "main";

type VaultPayload = Record<string, unknown>;

let cache: VaultPayload | null = null;
let dbp: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
  return dbp;
}

async function idbGet(): Promise<{ data: string; iv: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as { data: string; iv: string }) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(payload: { data: string; iv: string }) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Migre l'ancien localStorage vers IDB (une fois) */
export async function migrateLegacyStorage(): Promise<void> {
  const legacy = localStorage.getItem("crypt-db-v1");
  if (!legacy || (await idbGet()) !== null) return;
  try {
    const parsed = JSON.parse(legacy);
    const enc = await encryptPayload(parsed);
    if (enc.iv) await idbSet(enc);
    localStorage.removeItem("crypt-db-v1");
  } catch {
    /* ignore */
  }
}

export async function loadVault<T extends VaultPayload>(): Promise<T> {
  if (cache) return cache as T;
  const row = await idbGet();
  if (!row) return {} as T;
  const data = await decryptPayload<T>(row.data, row.iv);
  cache = (data ?? {}) as VaultPayload;
  return cache as T;
}

export async function saveVault(data: VaultPayload): Promise<void> {
  cache = data;
  const enc = await encryptPayload(data);
  await idbSet(enc);
}

export function invalidateVaultCache() {
  cache = null;
}

export async function patchVault(mutate: (data: VaultPayload) => void): Promise<void> {
  const data = { ...(await loadVault()) };
  mutate(data);
  await saveVault(data);
}
