import type { Profile } from "./types";

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

export function findPublicProfiles(query: string, excludeId: string): Profile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listPublicProfiles()
    .filter(
      (p) =>
        p.id !== excludeId &&
        (p.handle.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))
    )
    .slice(0, 12);
}
