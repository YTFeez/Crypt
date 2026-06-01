import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  getArchivedFolderItems,
  getArchivedDesigns,
  restoreFolderItem,
  restoreDesign,
  runAutoArchive,
} from "../lib/api";
import {
  getArchiveSettings,
  saveArchiveSettings,
  type ArchiveSettings,
} from "../lib/archive";
import type { FolderItem } from "../lib/types";
import type { DesignDoc } from "../lib/design/types";

export function ArchivesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FolderItem[]>([]);
  const [designs, setDesigns] = useState<DesignDoc[]>([]);
  const [settings, setSettings] = useState<ArchiveSettings>(getArchiveSettings);

  const reload = useCallback(async () => {
    if (!user) return;
    const [f, d] = await Promise.all([
      getArchivedFolderItems(user.id),
      getArchivedDesigns(user.id),
    ]);
    setFiles(f);
    setDesigns(d);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void runAutoArchive(user.id).then(() => reload());
  }, [user, reload]);

  async function restoreFile(id: string) {
    await restoreFolderItem(id);
    await reload();
  }

  async function restoreDoc(id: string) {
    await restoreDesign(id);
    await reload();
  }

  function updateSettings(patch: Partial<ArchiveSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveArchiveSettings(next);
  }

  return (
    <>
      <header className="page-header">
        <h1>Archives</h1>
        <p>Fichiers et créations archivés automatiquement — vous pouvez tout restaurer.</p>
      </header>

      <div className="panel" style={{ maxWidth: 520, marginBottom: "1rem" }}>
        <div className="panel-header"><strong>Règles d&apos;archivage</strong></div>
        <div className="panel-body stack">
          <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => updateSettings({ enabled: e.target.checked })}
            />
            Archiver automatiquement les éléments trop anciens
          </label>
          <div className="field">
            <label>Après (jours)</label>
            <input
              type="number"
              min={7}
              max={3650}
              value={settings.daysBeforeArchive}
              onChange={(e) => updateSettings({ daysBeforeArchive: Number(e.target.value) })}
            />
          </div>
          {user ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void runAutoArchive(user.id).then(reload)}>
              Lancer l&apos;archivage maintenant
            </button>
          ) : null}
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-header"><strong>Fichiers archivés ({files.length})</strong></div>
          <div className="panel-body">
            {files.length === 0 ? (
              <p className="muted">Aucun fichier archivé.</p>
            ) : (
              <ul className="archive-list">
                {files.map((f) => (
                  <li key={f.id}>
                    <div>
                      <strong>{f.name}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                        Archivé le {new Date(f.archived_at!).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void restoreFile(f.id)}>
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><strong>Studio archivé ({designs.length})</strong></div>
          <div className="panel-body">
            {designs.length === 0 ? (
              <p className="muted">Aucune création archivée.</p>
            ) : (
              <ul className="archive-list">
                {designs.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.name}</strong>
                      <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                        {d.width}×{d.height} · archivé le{" "}
                        {new Date(d.archived_at!).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void restoreDoc(d.id)}>
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/app/studio" className="btn btn-ghost btn-sm" style={{ marginTop: "0.75rem" }}>
              Ouvrir le Studio
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
