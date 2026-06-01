/** Archivage récupérable — fichiers et créations trop anciens */

export type ArchiveSettings = {
  enabled: boolean;
  daysBeforeArchive: number;
};

const SETTINGS_KEY = "talkeo-archive-settings";

export const DEFAULT_ARCHIVE_SETTINGS: ArchiveSettings = {
  enabled: true,
  daysBeforeArchive: 90,
};

export function getArchiveSettings(): ArchiveSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_ARCHIVE_SETTINGS };
    return { ...DEFAULT_ARCHIVE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_ARCHIVE_SETTINGS };
  }
}

export function saveArchiveSettings(s: ArchiveSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function isArchived(item: { archived_at?: string | null }): boolean {
  return Boolean(item.archived_at);
}

export function shouldAutoArchive(createdAt: string, settings = getArchiveSettings()): boolean {
  if (!settings.enabled) return false;
  const age = Date.now() - new Date(createdAt).getTime();
  return age > settings.daysBeforeArchive * 24 * 60 * 60 * 1000;
}

export function archiveTimestamp(): string {
  return new Date().toISOString();
}
