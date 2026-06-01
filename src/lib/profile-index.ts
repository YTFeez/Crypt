import type { Profile } from "./types";
import { isServerMode } from "./server-mode";
import { apiFetch } from "./server-api";

const KEY = "crypt-profile-index-v1";

export function listPublicProfiles(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Profile[];
  } catch {
    return [];
  }
}

export function upsertPublicProfile(profile: Profile) {
  const list = listPublicProfiles().filter((p) => p.id !== profile.id);
  list.push(profile);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export async function findPublicProfiles(query: string, excludeId: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (isServerMode()) {
    const res = await apiFetch<Profile[]>(`/api/profiles/search?q=${encodeURIComponent(q)}`);
    return res.data ?? [];
  }
  return listPublicProfiles()
    .filter(
      (p) =>
        p.id !== excludeId &&
        (p.handle.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
    )
    .slice(0, 12);
}
