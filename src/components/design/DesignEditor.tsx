import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignDoc, DesignElement, DesignElementType } from "../../lib/design/types";
import { createElement, duplicateElement, nextZIndex } from "../../lib/design/types";
import { alignElements, snapValue } from "../../lib/design/align";
import { ExportMenu } from "./ExportMenu";

type Props = {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  onRename: (name: string) => void;
  onArchive?: () => void;
};

type DragMode =
  | { kind: "move"; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; handle: string; startX: number; startY: number; orig: DesignElement };

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function elementStyle(el: DesignElement): React.CSSProperties {
  const isGradient = el.fill.startsWith("linear-gradient");
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation}deg)`,
    opacity: el.opacity,
    zIndex: el.zIndex,
    pointerEvents: el.locked ? "none" : "auto",
    ...(el.type === "circle"
      ? { background: "transparent" }
      : el.type === "text"
      ? {
          color: el.fill,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          textAlign: el.textAlign,
          lineHeight: el.lineHeight,
          display: "flex",
          alignItems: "flex-start",
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }
      : el.type === "image"
        ? { objectFit: "cover" as const }
        : {
            background: isGradient ? el.fill : undefined,
            backgroundColor: isGradient ? undefined : el.fill,
            border:
              el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
            borderRadius: el.borderRadius,
          }),
  };
}

export function DesignEditor({ doc, onChange, onRename, onArchive }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.55);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [snapGrid, setSnapGrid] = useState(true);
  const dragRef = useRef<DragMode | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<DesignDoc[]>([doc]);
  const histIdxRef = useRef(0);
  const docRef = useRef(doc);
  const rafRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  docRef.current = doc;

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;

  const pushHistory = useCallback(
    (next: DesignDoc) => {
      const h = historyRef.current.slice(0, histIdxRef.current + 1);
      h.push(JSON.parse(JSON.stringify(next)) as DesignDoc);
      if (h.length > 50) h.shift();
      historyRef.current = h;
      histIdxRef.current = h.length - 1;
      onChange(next);
    },
    [onChange]
  );

  /** Mise à jour visuelle sans empiler l'historique (déplacement / redimensionnement) */
  const applyDocLive = useCallback(
    (next: DesignDoc) => {
      docRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const updateDoc = useCallback(
    (patch: Partial<DesignDoc> | ((d: DesignDoc) => DesignDoc)) => {
      const base = docRef.current;
      const next = typeof patch === "function" ? patch(base) : { ...base, ...patch };
      pushHistory(next);
    },
    [pushHistory]
  );

  function undo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current -= 1;
    onChange(historyRef.current[histIdxRef.current]!);
  }

  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current += 1;
    onChange(historyRef.current[histIdxRef.current]!);
  }

  const updateElement = useCallback(
    (id: string, patch: Partial<DesignElement>, live = false) => {
      const base = docRef.current;
      const next = {
        ...base,
        elements: base.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
      if (live) applyDocLive(next);
      else pushHistory(next);
    },
    [applyDocLive, pushHistory]
  );

  const addElement = (type: DesignElementType) => {
    const z = nextZIndex(doc.elements);
    const cx = doc.width / 2 - 100;
    const cy = doc.height / 2 - 50;
    let el: DesignElement;
    if (type === "text") {
      el = createElement("text", {
        x: cx,
        y: cy,
        width: 320,
        height: 80,
        content: "Double-cliquez pour modifier",
        fontSize: 32,
        fill: "#0f172a",
        zIndex: z,
      });
    } else if (type === "rect") {
      el = createElement("rect", {
        x: cx,
        y: cy,
        width: 200,
        height: 120,
        fill: "#0866ff",
        borderRadius: 8,
        zIndex: z,
      });
    } else if (type === "circle") {
      el = createElement("circle", {
        x: cx,
        y: cy,
        width: 140,
        height: 140,
        fill: "#7c3aed",
        zIndex: z,
      });
    } else if (type === "triangle") {
      el = createElement("triangle", {
        x: cx,
        y: cy,
        width: 120,
        height: 100,
        fill: "#06b6d4",
        zIndex: z,
      });
    } else {
      el = createElement("line", {
        x: cx,
        y: cy + 40,
        width: 240,
        height: 8,
        fill: "#0f172a",
        stroke: "#0f172a",
        strokeWidth: 4,
        zIndex: z,
      });
    }
    updateDoc({ elements: [...doc.elements, el] });
    setSelectedId(el.id);
    if (type === "text") setEditingTextId(el.id);
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    updateDoc({ elements: doc.elements.filter((e) => e.id !== selectedId) });
    setSelectedId(null);
  }, [selectedId, doc.elements, updateDoc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingTextId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") setSelectedId(null);
      if (selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        updateElement(selected.id, { x: selected.x + dx, y: selected.y + dy });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selected) {
        e.preventDefault();
        const dup = duplicateElement(selected);
        updateDoc({ elements: [...doc.elements, dup] });
        setSelectedId(dup.id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selectedId, editingTextId, deleteSelected, updateElement, updateDoc, doc.elements]);

  useEffect(() => {
    const flushDrag = (e: PointerEvent) => {
      const d = dragRef.current;
      const sid = selectedId;
      if (!d || !sid) return;

      const applyPatch = (patch: Partial<DesignElement>) => {
        const base = docRef.current;
        applyDocLive({
          ...base,
          elements: base.elements.map((el) => (el.id === sid ? { ...el, ...patch } : el)),
        });
      };

      if (d.kind === "move") {
        applyPatch({
          x: d.origX + (e.clientX - d.startX) / zoom,
          y: d.origY + (e.clientY - d.startY) / zoom,
        });
      } else if (d.kind === "resize") {
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        const o = d.orig;
        let { x, y, width, height } = o;
        const h = d.handle;
        if (h.includes("e")) width = Math.max(20, o.width + dx);
        if (h.includes("w")) {
          width = Math.max(20, o.width - dx);
          x = o.x + o.width - width;
        }
        if (h.includes("s")) height = Math.max(12, o.height + dy);
        if (h.includes("n")) {
          height = Math.max(12, o.height - dy);
          y = o.y + o.height - height;
        }
        applyPatch({ x, y, width, height });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        flushDrag(e);
      });
    };

    const onUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const d = dragRef.current;
      const sid = selectedId;
      if (d && sid) {
        let next = docRef.current;
        if (d.kind === "move" && snapGrid) {
          const el = next.elements.find((x) => x.id === sid);
          if (el) {
            next = {
              ...next,
              elements: next.elements.map((e) =>
                e.id === sid ? { ...e, x: snapValue(el.x), y: snapValue(el.y) } : e
              ),
            };
          }
        }
        pushHistory(next);
      }
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedId, zoom, snapGrid, applyDocLive, pushHistory]);

  function onImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(400, doc.width * 0.6);
        const scale = maxW / img.width;
        const w = img.width * scale;
        const h = img.height * scale;
        const el = createElement("image", {
          x: (doc.width - w) / 2,
          y: (doc.height - h) / 2,
          width: w,
          height: h,
          src,
          fill: "transparent",
          zIndex: nextZIndex(doc.elements),
        });
        updateDoc({ elements: [...doc.elements, el] });
        setSelectedId(el.id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function layerAction(action: "up" | "down" | "front" | "back") {
    if (!selected) return;
    const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === selected.id);
    if (idx < 0) return;
    let z = selected.zIndex;
    if (action === "front") z = nextZIndex(doc.elements);
    else if (action === "back") z = 0;
    else if (action === "up") z = sorted[Math.min(sorted.length - 1, idx + 1)].zIndex + 1;
    else z = Math.max(0, sorted[Math.max(0, idx - 1)].zIndex - 1);
    updateElement(selected.id, { zIndex: z });
  }

  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="design-editor">
      <div className="design-toolbar">
        <input
          className="design-title-input"
          value={doc.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <div className="design-tool-group">
          <button type="button" className="btn btn-sm btn-ghost" title="Texte" onClick={() => addElement("text")}>
            T
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Rectangle" onClick={() => addElement("rect")}>
            ▢
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Cercle" onClick={() => addElement("circle")}>
            ○
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Triangle" onClick={() => addElement("triangle")}>
            △
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Ligne" onClick={() => addElement("line")}>
            —
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Image" onClick={() => fileRef.current?.click()}>
            🖼
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="design-tool-group">
          <button type="button" className="btn btn-sm btn-ghost" title="Annuler" onClick={undo}>
            ↶
          </button>
          <button type="button" className="btn btn-sm btn-ghost" title="Rétablir" onClick={redo}>
            ↷
          </button>
          <button
            type="button"
            className={`btn btn-sm ${snapGrid ? "btn-primary" : "btn-ghost"}`}
            title="Grille magnétique"
            onClick={() => setSnapGrid((s) => !s)}
          >
            ⊞
          </button>
        </div>
        {selected ? (
          <div className="design-tool-group">
            {(["left", "center-h", "right", "top", "center-v", "bottom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="btn btn-sm btn-ghost"
                title={m}
                onClick={() =>
                  updateDoc({
                    elements: alignElements(doc.elements, [selected.id], m, {
                      width: doc.width,
                      height: doc.height,
                    }),
                  })
                }
              >
                {m === "left" ? "⫷" : m === "right" ? "⫸" : m === "center-h" ? "═" : m === "top" ? "⫠" : m === "bottom" ? "⫡" : "║"}
              </button>
            ))}
          </div>
        ) : null}
        <div className="design-tool-group">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>
            −
          </button>
          <span className="design-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
            +
          </button>
        </div>
        <ExportMenu doc={doc} />
        {onArchive ? (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onArchive}>
            Archiver
          </button>
        ) : null}
      </div>

      <div className="design-workspace">
        <aside className="design-inspector">
          <h3>Calques</h3>
          <ul className="design-layers">
            {[...sorted].reverse().map((el) => (
              <li key={el.id}>
                <button
                  type="button"
                  className={el.id === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(el.id)}
                >
                  {el.type === "text" ? "📝" : el.type === "image" ? "🖼" : "◆"} {el.type}
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <div className="design-props">
              <h3>Propriétés</h3>
              {selected.type === "text" ? (
                <div className="field">
                  <label>Texte</label>
                  <textarea
                    rows={3}
                    value={selected.content ?? ""}
                    onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="field">
                <label>Couleur</label>
                <input
                  type="color"
                  value={selected.fill.startsWith("#") ? selected.fill : "#0866ff"}
                  onChange={(e) => updateElement(selected.id, { fill: e.target.value })}
                />
              </div>
              {selected.type === "text" ? (
                <div className="field">
                  <label>Taille police</label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={selected.fontSize ?? 24}
                    onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
                  />
                </div>
              ) : null}
              {selected.type === "rect" ? (
                <div className="field">
                  <label>Coins arrondis</label>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={selected.borderRadius ?? 0}
                    onChange={(e) => updateElement(selected.id, { borderRadius: Number(e.target.value) })}
                  />
                </div>
              ) : null}
              <div className="field">
                <label>Opacité</label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selected.opacity}
                  onChange={(e) => updateElement(selected.id, { opacity: Number(e.target.value) })}
                />
              </div>
              <div className="design-prop-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => layerAction("front")}>
                  Premier plan
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => layerAction("back")}>
                  Arrière-plan
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    const dup = duplicateElement(selected);
                    updateDoc({ elements: [...doc.elements, dup] });
                    setSelectedId(dup.id);
                  }}
                >
                  Dupliquer
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={deleteSelected}>
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <div className="field">
              <label>Fond de page</label>
              <input
                type="color"
                value={doc.background.startsWith("#") ? doc.background : "#ffffff"}
                onChange={(e) => updateDoc({ background: e.target.value })}
              />
            </div>
          )}
        </aside>

        <div
          className="design-viewport"
          ref={viewportRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div
            className="design-canvas-wrap"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          >
            <div
              className={`design-page${isDragging ? " is-dragging" : ""}`}
              style={{
                width: doc.width,
                height: doc.height,
                background: doc.background,
                touchAction: "none",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {sorted.map((el) => (
                <div
                  key={el.id}
                  className={`design-el design-el-${el.type}${el.id === selectedId ? " is-selected" : ""}${el.id === selectedId && isDragging ? " is-dragging-el" : ""}`}
                  style={elementStyle(el)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (el.locked) return;
                    setSelectedId(el.id);
                    setIsDragging(true);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    dragRef.current = {
                      kind: "move",
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: el.x,
                      origY: el.y,
                    };
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (el.type === "text") setEditingTextId(el.id);
                  }}
                >
                  {el.type === "text" ? (
                    editingTextId === el.id ? (
                      <textarea
                        className="design-text-edit"
                        autoFocus
                        value={el.content ?? ""}
                        onChange={(ev) => updateElement(el.id, { content: ev.target.value })}
                        onBlur={() => setEditingTextId(null)}
                        onPointerDown={(ev) => ev.stopPropagation()}
                      />
                    ) : (
                      el.content
                    )
                  ) : el.type === "image" && el.src ? (
                    <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : el.type === "circle" ? (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        background: el.fill.startsWith("linear") ? el.fill : el.fill,
                        border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
                      }}
                    />
                  ) : el.type === "triangle" ? (
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: `${el.width / 2}px solid transparent`,
                        borderRight: `${el.width / 2}px solid transparent`,
                        borderBottom: `${el.height}px solid ${el.fill}`,
                      }}
                    />
                  ) : el.type === "line" ? (
                    <div
                      style={{
                        width: "100%",
                        height: el.strokeWidth || 4,
                        marginTop: (el.height - (el.strokeWidth || 4)) / 2,
                        background: el.stroke || el.fill,
                        borderRadius: 4,
                      }}
                    />
                  ) : null}
                </div>
              ))}

              {selected && !editingTextId && !isDragging ? (
                <div
                  className="design-selection"
                  style={{
                    left: selected.x,
                    top: selected.y,
                    width: selected.width,
                    height: selected.height,
                    transform: `rotate(${selected.rotation}deg)`,
                    zIndex: 9999,
                  }}
                >
                  {HANDLES.map((h) => (
                    <span
                      key={h}
                      className={`design-handle design-handle-${h}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsDragging(true);
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        dragRef.current = {
                          kind: "resize",
                          handle: h,
                          startX: e.clientX,
                          startY: e.clientY,
                          orig: { ...selected },
                        };
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
