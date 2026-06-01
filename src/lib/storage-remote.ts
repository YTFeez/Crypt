import { decryptPayload, encryptPayload } from "./crypto";
import { apiFetch } from "./server-api";

type VaultPayload = Record<string, unknown>;

const cache = new Map<string, VaultPayload>();

export const SHARED_VAULT_ID = "__shared__";

export async function migrateLegacyStorage(): Promise<void> {
  /* rien — données sur le VPS */
}

export async function loadVault<T extends VaultPayload>(userId: string): Promise<T> {
  const hit = cache.get(userId);
  if (hit) return hit as T;

  const res = await apiFetch<{ data: string; iv: string }>("/api/vault");
  if (res.error || !res.data) return {} as T;

  const parsed = await decryptPayload<T>(res.data.data, res.data.iv);
  const merged = (parsed ?? {}) as VaultPayload;
  cache.set(userId, merged);
  return merged as T;
}

export async function saveVault(userId: string, data: VaultPayload, plain = false): Promise<void> {
  cache.set(userId, data);
  let payload: { data: string; iv: string };
  if (plain) {
    payload = { data: JSON.stringify(data), iv: "" };
  } else {
    payload = await encryptPayload(data);
  }
  const res = await apiFetch("/api/vault", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (res.error) throw new Error(res.error);
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
