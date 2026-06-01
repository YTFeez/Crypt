import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  getFolders,
  createFolder,
  getFolderItems,
  addFolderItem,
  shareFolder,
  searchProfiles,
} from "../lib/api";
import type { Folder, FolderItem, Profile } from "../lib/types";

export function FoldersPage() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [newName, setNewName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [shareHandle, setShareHandle] = useState("");
  const [shareResults, setShareResults] = useState<Profile[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    const list = await getFolders(user.id);
    setFolders(list);
    if (!activeId && list[0]) setActiveId(list[0].id);
  }, [user, activeId]);

  const reloadItems = useCallback(async () => {
    if (!activeId) return;
    setItems(await getFolderItems(activeId));
  }, [activeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void reloadItems();
  }, [reloadItems]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    await createFolder(user.id, newName.trim(), null, isShared);
    setNewName("");
    await reload();
  }

  async function onUpload(file: File) {
    if (!user || !activeId) return;
    await addFolderItem(activeId, file, user.id);
    await reloadItems();
  }

  useEffect(() => {
    if (!user || shareHandle.length < 2) {
      setShareResults([]);
      return;
    }
    void searchProfiles(shareHandle, user.id).then(setShareResults);
  }, [shareHandle, user]);

  const active = folders.find((f) => f.id === activeId);

  return (
    <>
      <header className="page-header">
        <h1>Dossiers</h1>
        <p>Dossiers personnels et espaces partagés avec votre équipe.</p>
      </header>

      <div className="split">
        <div className="stack">
          <div className="panel">
            <div className="panel-header"><strong>Mes dossiers</strong></div>
            <div className="panel-body" style={{ padding: "0.5rem" }}>
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`list-item${f.id === activeId ? " active" : ""}`}
                  onClick={() => setActiveId(f.id)}
                >
                  <span>{f.is_shared ? "📂" : "📁"}</span>
                  <span>
                    {f.name}
                    {f.is_shared ? <span className="badge" style={{ marginLeft: 6 }}>Partagé</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form className="panel panel-body stack" onSubmit={onCreate}>
            <strong>Nouveau dossier</strong>
            <input
              placeholder="Nom du dossier"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ padding: "0.65rem", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
            />
            <label className="row" style={{ fontSize: "0.9rem" }}>
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
              Dossier commun (partageable)
            </label>
            <button type="submit" className="btn btn-primary btn-sm">Créer</button>
          </form>
        </div>

        <div className="panel">
          {active ? (
            <>
              <div className="panel-header">
                <strong>{active.name}</strong>
                <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                  + Fichier
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="panel-body">
                {active.is_shared ? (
                  <div className="stack" style={{ marginBottom: "1.5rem" }}>
                    <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>Inviter un collègue</p>
                    <input
                      placeholder="Rechercher par handle…"
                      value={shareHandle}
                      onChange={(e) => setShareHandle(e.target.value)}
                      style={{ padding: "0.65rem", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
                    />
                    {shareResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void shareFolder(active.id, p.id, "write")}
                      >
                        Partager avec @{p.handle}
                      </button>
                    ))}
                  </div>
                ) : null}

                {items.length === 0 ? (
                  <p className="muted">Dossier vide — déposez un document.</p>
                ) : (
                  <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {items.map((item) => (
                      <li key={item.id} className="row" style={{ justifyContent: "space-between" }}>
                        <span>📄 {item.name}</span>
                        <span className="muted" style={{ fontSize: "0.8rem" }}>
                          {(item.size_bytes / 1024).toFixed(1)} Ko
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">Créez ou sélectionnez un dossier</div>
          )}
        </div>
      </div>
    </>
  );
}
