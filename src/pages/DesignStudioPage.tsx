import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  getDesigns,
  createDesign,
  saveDesign,
  deleteDesign,
  renameDesign,
} from "../lib/api";
import {
  DESIGN_TEMPLATES,
  createDesignFromTemplate,
  type DesignDoc,
  type DesignTemplate,
} from "../lib/design/types";
import { DesignEditor } from "../components/design/DesignEditor";
import { subscribeDesign } from "../lib/subscriptions";

export function DesignStudioPage() {
  const { user } = useAuth();
  const [designs, setDesigns] = useState<DesignDoc[]>([]);
  const [active, setActive] = useState<DesignDoc | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const docRef = useRef<DesignDoc | null>(null);

  useEffect(() => {
    if (!user) return;
    void getDesigns(user.id).then(setDesigns);
  }, [user]);

  useEffect(() => {
    docRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active?.id || !user) return;
    return subscribeDesign(active.id, () => {
      void getDesigns(user.id).then((list) => {
        const remote = list.find((d) => d.id === active.id);
        if (remote && docRef.current?.id === remote.id) {
          const localTs = docRef.current.updated_at;
          if (remote.updated_at > localTs) setActive(remote);
        }
      });
    });
  }, [active?.id, user]);

  function scheduleSave(doc: DesignDoc) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDesign(doc);
    }, 500);
  }

  function handleDocChange(doc: DesignDoc) {
    setActive(doc);
    setDesigns((list) => list.map((d) => (d.id === doc.id ? doc : d)));
    scheduleSave(doc);
  }

  async function startFromTemplate(template: DesignTemplate) {
    if (!user) return;
    const doc = createDesignFromTemplate(user.id, template);
    await createDesign(doc);
    setDesigns((d) => [doc, ...d]);
    setActive(doc);
    setShowTemplates(false);
  }

  async function startBlank() {
    await startFromTemplate(DESIGN_TEMPLATES[0]);
  }

  async function removeDesign(id: string) {
    if (!user || !confirm("Supprimer ce document ?")) return;
    await deleteDesign(id, user.id);
    setDesigns((d) => d.filter((x) => x.id !== id));
    if (active?.id === id) setActive(null);
  }

  return (
    <div className="design-studio-page">
      <header className="page-header row" style={{ justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h1>Studio</h1>
          <p>Créez des visuels, affiches et présentations comme sur Canva.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowTemplates(true)}>
          + Nouveau document
        </button>
      </header>

      <div className="design-studio-layout">
        <aside className="design-doc-list panel">
          <div className="panel-header"><strong>Mes créations</strong></div>
          <div className="panel-body" style={{ padding: "0.35rem" }}>
            {designs.length === 0 ? (
              <p className="muted" style={{ padding: "0.75rem", fontSize: "0.875rem", margin: 0 }}>
                Aucun document. Créez-en un avec un modèle.
              </p>
            ) : (
              designs.map((d) => (
                <div key={d.id} className={`design-doc-item${d.id === active?.id ? " active" : ""}`}>
                  <button type="button" className="list-item" onClick={() => setActive(d)}>
                    <span className="design-doc-thumb" style={{ background: d.background }} />
                    <span className="list-item-text">
                      <strong>{d.name}</strong>
                      <span>
                        {d.width}×{d.height}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm design-doc-del"
                    title="Supprimer"
                    onClick={() => void removeDesign(d.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="design-studio-main">
          {active ? (
            <DesignEditor
              doc={active}
              onChange={handleDocChange}
              onRename={(name) => {
                const next = { ...active, name };
                setActive(next);
                setDesigns((list) => list.map((d) => (d.id === next.id ? next : d)));
                void renameDesign(active.id, name);
                scheduleSave(next);
              }}
            />
          ) : (
            <div className="design-empty panel">
              <div className="empty-state" style={{ padding: "3rem" }}>
                <h2 style={{ margin: "0 0 0.5rem" }}>Commencez une création</h2>
                <p className="muted">Choisissez un format ou un modèle prêt à personnaliser.</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={() => setShowTemplates(true)}>
                  Parcourir les modèles
                </button>
                <button type="button" className="btn btn-secondary" style={{ marginTop: "0.5rem" }} onClick={() => void startBlank()}>
                  Page blanche A4
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showTemplates ? (
        <div className="design-modal-backdrop" onClick={() => setShowTemplates(false)}>
          <div className="design-modal panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header row" style={{ justifyContent: "space-between" }}>
              <strong>Nouveau document</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTemplates(false)}>
                Fermer
              </button>
            </div>
            <div className="panel-body design-template-grid">
              {DESIGN_TEMPLATES.map((t) => (
                <button key={t.id} type="button" className="design-template-card" onClick={() => void startFromTemplate(t)}>
                  <div
                    className="design-template-preview"
                    style={{
                      aspectRatio: `${t.width} / ${t.height}`,
                      background: t.background,
                    }}
                  />
                  <strong>{t.name}</strong>
                  <span className="muted">
                    {t.width} × {t.height} px
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
