import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  getFolders,
  createFolder,
  getFolderItems,
  addFolderItem,
  shareFolder,
  searchProfiles,
  archiveFolderItem,
  runAutoArchive,
} from "../lib/api";
import type { Folder, FolderItem, Profile } from "../lib/types";
import { PageLoader } from "../components/PageLoader";
import { SkeletonList } from "../components/Skeleton";
import { IconFolder, IconFile, IconUpload, IconShare, IconArchive, IconUsers } from "../components/Icons";

export function FoldersPage() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [newName, setNewName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [shareHandle, setShareHandle] = useState("");
  const [shareResults, setShareResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await runAutoArchive(user.id);
      const list = await getFolders(user.id);
      setFolders(list);
      if (!activeId && list[0]) setActiveId(list[0].id);
    } finally {
      setLoading(false);
    }
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

  if (loading && folders.length === 0) {
    return <PageLoader label="Chargement des dossiers…" />;
  }

  return (
    <>
      <header className="page-header row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Dossiers</h1>
          <p>Dossiers personnels et espaces partagés avec votre équipe.</p>
        </div>
        <Link to="/app/archives" className="btn btn-secondary btn-sm">
          <IconArchive size={14} />
          Archives
        </Link>
      </header>

      <div className="split">
        <div className="stack">
          <div className="panel">
            <div className="panel-header"><strong>Mes dossiers</strong></div>
            <div className="panel-body" style={{ padding: "0.5rem" }}>
              {loading ? (
                <SkeletonList rows={4} />
              ) : folders.length === 0 ? (
                <p className="muted" style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
                  Aucun dossier. Créez-en un ci-dessous.
                </p>
              ) : (
                folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`list-item${f.id === activeId ? " active" : ""}`}
                    onClick={() => setActiveId(f.id)}
                  >
                    <span style={{ color: f.is_shared ? "var(--accent)" : "var(--primary)", display: "flex", flexShrink: 0 }}>
                      <IconFolder size={18} />
                    </span>
                    <span className="list-item-text">
                      <strong>{f.name}</strong>
                      <span>{f.is_shared ? "Dossier partagé" : "Personnel"}</span>
                    </span>
                    {f.is_shared ? (
                      <span className="badge" title="Partagé"><IconUsers size={11} /></span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <form className="panel" onSubmit={onCreate}>
            <div className="panel-header"><strong>Nouveau dossier</strong></div>
            <div className="panel-body stack">
              <div className="field">
                <label htmlFor="folder-name">Nom du dossier</label>
                <input
                  id="folder-name"
                  placeholder="Ex : Rapports Q3"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <label className="row" style={{ fontSize: "0.9rem", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
                Dossier partageable avec l'équipe
              </label>
              <button type="submit" className="btn btn-primary btn-sm">Créer</button>
            </div>
          </form>
        </div>

        <div className="panel">
          {active ? (
            <>
              <div className="panel-header">
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <IconFolder size={16} />
                  <strong>{active.name}</strong>
                  {active.is_shared ? <span className="badge">Partagé</span> : null}
                </span>
                <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <IconUpload size={14} />
                  Déposer
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
              <div className="panel-body stack">
                {active.is_shared ? (
                  <div className="stack" style={{ padding: "0.75rem", background: "var(--bg-subtle)", borderRadius: "var(--radius)", marginBottom: "0.5rem" }}>
                    <p className="muted" style={{ margin: 0, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <IconShare size={14} />
                      Inviter un collègue par handle
                    </p>
                    <div className="field" style={{ margin: 0 }}>
                      <input
                        placeholder="@handle…"
                        value={shareHandle}
                        onChange={(e) => setShareHandle(e.target.value)}
                      />
                    </div>
                    {shareResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: "flex-start" }}
                        onClick={() => void shareFolder(active.id, p.id, "write")}
                      >
                        <span className="avatar sm">{p.display_name[0]}</span>
                        @{p.handle} — {p.display_name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {items.length === 0 ? (
                  <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                    <div style={{ opacity: 0.3, marginBottom: "0.5rem" }}><IconFile size={32} /></div>
                    <p style={{ margin: 0 }}>Dossier vide — déposez un document.</p>
                  </div>
                ) : (
                  <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {items.map((item) => (
                      <li key={item.id} className="row" style={{ justifyContent: "space-between", gap: "0.5rem", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                        <span className="row" style={{ gap: "0.5rem", minWidth: 0 }}>
                          <span style={{ flexShrink: 0, color: "var(--primary)", display: "flex" }}><IconFile size={16} /></span>
                          <span style={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                        </span>
                        <span className="row" style={{ gap: "0.5rem", flexShrink: 0 }}>
                          <span className="muted" style={{ fontSize: "0.8rem" }}>
                            {(item.size_bytes / 1024).toFixed(1)} Ko
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Archiver"
                            style={{ gap: "0.3rem" }}
                            onClick={() => void archiveFolderItem(item.id).then(reloadItems)}
                          >
                            <IconArchive size={13} />
                            Archiver
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: "3rem 1.5rem" }}>
              <div style={{ opacity: 0.2, marginBottom: "0.75rem" }}><IconFolder size={40} /></div>
              <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>Sélectionnez un dossier</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                Ou créez-en un nouveau dans la colonne de gauche.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
