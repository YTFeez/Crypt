import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignDoc, DesignElement, DesignElementType } from "../../lib/design/types";
import { createElement, duplicateElement, nextZIndex } from "../../lib/design/types";
import { alignElements, snapValue } from "../../lib/design/align";
import { ExportMenu } from "./ExportMenu";
import { DesignToolPalette } from "./DesignToolPalette";
import {
  IconEye, IconEyeOff, IconLayers, IconType, IconImage2,
  IconAlignLeft, IconAlignCenter, IconAlignRight,
  IconBold, IconItalic, IconZoomIn, IconZoomOut, IconMaximize2,
  IconLock, IconUnlock,
} from "../Icons";

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

const FONT_FAMILIES = [
  { label: "Inter (défaut)", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Impact", value: "Impact, sans-serif" },
];

const FONT_WEIGHTS = [
  { label: "Fin (300)", value: 300 },
  { label: "Normal (400)", value: 400 },
  { label: "Moyen (500)", value: 500 },
  { label: "Semi-gras (600)", value: 600 },
  { label: "Gras (700)", value: 700 },
  { label: "Extra-gras (800)", value: 800 },
  { label: "Noir (900)", value: 900 },
];

function elementStyle(el: DesignElement): React.CSSProperties {
  const isGradient = el.fill.startsWith("linear-gradient");
  const shadow = el.shadow && el.shadow !== "none" ? { boxShadow: el.shadow } : {};
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
    visibility: el.hidden ? "hidden" : "visible",
    ...shadow,
    ...(el.type === "circle"
      ? { background: "transparent" }
      : el.type === "text"
      ? {
          color: el.fill,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle ?? "normal",
          textAlign: el.textAlign,
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing ? `${el.letterSpacing}em` : undefined,
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
            border: el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
            borderRadius: el.borderRadius,
          }),
  };
}

function layerLabel(el: DesignElement): string {
  if (el.type === "text" && el.content) {
    const first = el.content.split("\n")[0] ?? "";
    return first.length > 22 ? first.slice(0, 22) + "…" : first || "Texte";
  }
  const names: Record<DesignElementType, string> = {
    rect: "Rectangle", circle: "Cercle", triangle: "Triangle",
    image: "Image", line: "Ligne", text: "Texte",
  };
  return names[el.type] ?? el.type;
}

function LayerTypeIcon({ type }: { type: DesignElementType }) {
  if (type === "text") return <IconType size={14} />;
  if (type === "image") return <IconImage2 size={14} />;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {type === "circle" ? <circle cx="12" cy="12" r="9" /> :
       type === "triangle" ? <path d="M12 4L2 20h20L12 4z" /> :
       type === "line" ? <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /> :
       <rect x="3" y="3" width="18" height="18" rx="3" />}
    </svg>
  );
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
  const clipboardRef = useRef<DesignElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  docRef.current = doc;

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;

  const pushHistory = useCallback(
    (next: DesignDoc) => {
      const h = historyRef.current.slice(0, histIdxRef.current + 1);
      h.push(JSON.parse(JSON.stringify(next)) as DesignDoc);
      if (h.length > 60) h.shift();
      historyRef.current = h;
      histIdxRef.current = h.length - 1;
      onChange(next);
    },
    [onChange]
  );

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
        x: cx, y: cy, width: 320, height: 80,
        content: "Double-cliquez pour modifier",
        fontSize: 32, fill: "#0f172a", zIndex: z,
      });
    } else if (type === "rect") {
      el = createElement("rect", { x: cx, y: cy, width: 200, height: 120, fill: "#0866ff", borderRadius: 8, zIndex: z });
    } else if (type === "circle") {
      el = createElement("circle", { x: cx, y: cy, width: 140, height: 140, fill: "#7b3fe4", zIndex: z });
    } else if (type === "triangle") {
      el = createElement("triangle", { x: cx, y: cy, width: 120, height: 100, fill: "#06b6d4", zIndex: z });
    } else {
      el = createElement("line", {
        x: cx, y: cy + 40, width: 240, height: 8,
        fill: "#0f172a", stroke: "#0f172a", strokeWidth: 4, zIndex: z,
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

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const dup = duplicateElement(selected);
    updateDoc({ elements: [...doc.elements, dup] });
    setSelectedId(dup.id);
  }, [selected, doc.elements, updateDoc]);

  const fitZoom = useCallback(() => {
    const vw = (viewportRef.current?.clientWidth ?? 800) - 80;
    const vh = (viewportRef.current?.clientHeight ?? 600) - 80;
    const scaleX = vw / doc.width;
    const scaleY = vh / doc.height;
    setZoom(Math.min(scaleX, scaleY, 1.5));
  }, [doc.width, doc.height]);

  useEffect(() => {
    fitZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

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
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selected) {
        e.preventDefault();
        clipboardRef.current = JSON.parse(JSON.stringify(selected)) as DesignElement;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboardRef.current) {
        e.preventDefault();
        const dup = duplicateElement(clipboardRef.current);
        updateDoc({ elements: [...doc.elements, dup] });
        setSelectedId(dup.id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, selectedId, editingTextId, deleteSelected, duplicateSelected, updateElement, updateDoc, doc.elements]);

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
        if (h.includes("w")) { width = Math.max(20, o.width - dx); x = o.x + o.width - width; }
        if (h.includes("s")) height = Math.max(12, o.height + dy);
        if (h.includes("n")) { height = Math.max(12, o.height - dy); y = o.y + o.height - height; }
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
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
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
          width: w, height: h, src,
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
    else if (action === "up") z = sorted[Math.min(sorted.length - 1, idx + 1)]!.zIndex + 1;
    else z = Math.max(0, sorted[Math.max(0, idx - 1)]!.zIndex - 1);
    updateElement(selected.id, { zIndex: z });
  }

  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="design-editor">
      {/* Toolbar */}
      <div className="design-toolbar">
        <input
          className="design-title-input"
          value={doc.name}
          onChange={(e) => onRename(e.target.value)}
          title="Renommer le document"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageFile(f); e.target.value = ""; }}
        />
        <div className="design-tool-group">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))} title="Dézoomer">
            <IconZoomOut size={16} />
          </button>
          <span className="design-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} title="Zoomer">
            <IconZoomIn size={16} />
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={fitZoom} title="Ajuster à l'écran">
            <IconMaximize2 size={16} />
          </button>
        </div>
        <div className="design-tool-group">
          <ExportMenu doc={doc} />
          {onArchive ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={onArchive}>
              Archiver
            </button>
          ) : null}
        </div>
      </div>

      <div className="design-workspace">
        {/* Left palette */}
        <DesignToolPalette
          onAdd={addElement}
          onPickImage={() => fileRef.current?.click()}
          onUndo={undo}
          onRedo={redo}
          snapGrid={snapGrid}
          onToggleSnap={() => setSnapGrid((s) => !s)}
          hasSelection={!!selected}
          onAlign={(m) => {
            if (!selected) return;
            updateDoc({
              elements: alignElements(doc.elements, [selected.id], m, { width: doc.width, height: doc.height }),
            });
          }}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Viewport */}
        <div
          className="design-viewport"
          ref={viewportRef}
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <div
            className="design-canvas-wrap"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
          >
            <div
              className={`design-page${isDragging ? " is-dragging" : ""}`}
              style={{ width: doc.width, height: doc.height, background: doc.background, touchAction: "none" }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {sorted.map((el) => (
                <div
                  key={el.id}
                  className={`design-el design-el-${el.type}${el.id === selectedId ? " is-selected" : ""}${el.id === selectedId && isDragging ? " is-dragging-el" : ""}`}
                  style={elementStyle(el)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (el.locked || el.hidden) return;
                    setSelectedId(el.id);
                    setIsDragging(true);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
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
                        onChange={(ev) => updateElement(el.id, { content: ev.target.value }, true)}
                        onBlur={() => { setEditingTextId(null); pushHistory(docRef.current); }}
                        onPointerDown={(ev) => ev.stopPropagation()}
                      />
                    ) : (el.content)
                  ) : el.type === "image" && el.src ? (
                    <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : el.type === "circle" ? (
                    <div style={{
                      width: "100%", height: "100%", borderRadius: "50%",
                      background: el.fill,
                      border: el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
                      boxShadow: el.shadow && el.shadow !== "none" ? el.shadow : undefined,
                    }} />
                  ) : el.type === "triangle" ? (
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: `${el.width / 2}px solid transparent`,
                      borderRight: `${el.width / 2}px solid transparent`,
                      borderBottom: `${el.height}px solid ${el.fill}`,
                    }} />
                  ) : el.type === "line" ? (
                    <div style={{
                      width: "100%", height: el.strokeWidth || 4,
                      marginTop: (el.height - (el.strokeWidth || 4)) / 2,
                      background: el.stroke || el.fill, borderRadius: 4,
                    }} />
                  ) : null}
                </div>
              ))}

              {selected && !editingTextId && !isDragging ? (
                <div
                  className="design-selection"
                  style={{
                    left: selected.x, top: selected.y,
                    width: selected.width, height: selected.height,
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
                        dragRef.current = { kind: "resize", handle: h, startX: e.clientX, startY: e.clientY, orig: { ...selected } };
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <aside className="design-inspector">
          {/* Layers */}
          <div className="design-inspector-section">
            <div className="design-section-header">
              <IconLayers size={14} />
              <span>Calques</span>
            </div>
            <ul className="design-layers">
              {[...sorted].reverse().map((el) => (
                <li key={el.id} className={`design-layer-item${el.id === selectedId ? " active" : ""}${el.hidden ? " hidden" : ""}`}>
                  <button
                    type="button"
                    className="design-layer-main"
                    onClick={() => setSelectedId(el.id)}
                  >
                    <span className="design-layer-icon"><LayerTypeIcon type={el.type} /></span>
                    <span className="design-layer-name">{layerLabel(el)}</span>
                  </button>
                  <button
                    type="button"
                    className="design-layer-action"
                    title={el.hidden ? "Afficher" : "Masquer"}
                    onClick={() => updateElement(el.id, { hidden: !el.hidden })}
                  >
                    {el.hidden ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                  </button>
                  <button
                    type="button"
                    className="design-layer-action"
                    title={el.locked ? "Déverrouiller" : "Verrouiller"}
                    onClick={() => updateElement(el.id, { locked: !el.locked })}
                  >
                    {el.locked ? <IconLock size={13} /> : <IconUnlock size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Properties */}
          {selected ? (
            <div className="design-props">
              {/* Position & Size */}
              <div className="design-inspector-section">
                <div className="design-section-header"><span>Position & Taille</span></div>
                <div className="design-prop-grid4">
                  {[
                    { key: "x", label: "X", val: selected.x },
                    { key: "y", label: "Y", val: selected.y },
                    { key: "width", label: "L", val: selected.width },
                    { key: "height", label: "H", val: selected.height },
                  ].map(({ key, label, val }) => (
                    <div key={key} className="design-prop-field">
                      <label>{label}</label>
                      <input
                        type="number"
                        value={Math.round(val)}
                        onChange={(e) => updateElement(selected.id, { [key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Transform */}
              <div className="design-inspector-section">
                <div className="design-section-header"><span>Transformation</span></div>
                <div className="design-prop-field-full">
                  <label>Rotation ({selected.rotation}°)</label>
                  <div className="design-slider-row">
                    <input
                      type="range" min={-180} max={180} step={1}
                      value={selected.rotation}
                      onChange={(e) => updateElement(selected.id, { rotation: Number(e.target.value) }, true)}
                      onPointerUp={() => pushHistory(docRef.current)}
                    />
                    <input
                      type="number" min={-180} max={180}
                      value={selected.rotation}
                      className="design-num-sm"
                      onChange={(e) => updateElement(selected.id, { rotation: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="design-prop-field-full">
                  <label>Opacité ({Math.round(selected.opacity * 100)}%)</label>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={selected.opacity}
                    onChange={(e) => updateElement(selected.id, { opacity: Number(e.target.value) }, true)}
                    onPointerUp={() => pushHistory(docRef.current)}
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="design-inspector-section">
                <div className="design-section-header"><span>Apparence</span></div>
                <div className="design-prop-field-full">
                  <label>Couleur de remplissage</label>
                  <div className="design-color-row">
                    <input
                      type="color"
                      value={selected.fill.startsWith("#") ? selected.fill : "#0866ff"}
                      onChange={(e) => updateElement(selected.id, { fill: e.target.value })}
                    />
                    <span className="design-color-val">{selected.fill.startsWith("#") ? selected.fill.toUpperCase() : "Dégradé"}</span>
                  </div>
                </div>
                {selected.type !== "image" && selected.type !== "line" ? (
                  <div className="design-prop-field-full">
                    <label>Contour</label>
                    <div className="design-inline-row">
                      <input
                        type="color"
                        value={selected.stroke && selected.stroke !== "transparent" ? selected.stroke : "#000000"}
                        onChange={(e) => updateElement(selected.id, { stroke: e.target.value })}
                      />
                      <input
                        type="number" min={0} max={40}
                        value={selected.strokeWidth}
                        className="design-num-sm"
                        onChange={(e) => updateElement(selected.id, { strokeWidth: Number(e.target.value) })}
                        title="Épaisseur du contour (px)"
                      />
                      <span className="design-unit">px</span>
                    </div>
                  </div>
                ) : null}
                {selected.type === "rect" ? (
                  <div className="design-prop-field-full">
                    <label>Coins arrondis ({selected.borderRadius ?? 0}px)</label>
                    <input
                      type="range" min={0} max={Math.min(selected.width, selected.height) / 2}
                      value={selected.borderRadius ?? 0}
                      onChange={(e) => updateElement(selected.id, { borderRadius: Number(e.target.value) }, true)}
                      onPointerUp={() => pushHistory(docRef.current)}
                    />
                  </div>
                ) : null}
              </div>

              {/* Text properties */}
              {selected.type === "text" ? (
                <div className="design-inspector-section">
                  <div className="design-section-header"><span>Texte</span></div>
                  <div className="design-prop-field-full">
                    <label>Contenu</label>
                    <textarea
                      rows={3}
                      value={selected.content ?? ""}
                      onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                    />
                  </div>
                  <div className="design-prop-field-full">
                    <label>Police</label>
                    <select
                      value={selected.fontFamily ?? "Inter, system-ui, sans-serif"}
                      onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })}
                    >
                      {FONT_FAMILIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="design-prop-grid2">
                    <div className="design-prop-field">
                      <label>Taille</label>
                      <input
                        type="number" min={6} max={400}
                        value={selected.fontSize ?? 24}
                        onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
                      />
                    </div>
                    <div className="design-prop-field">
                      <label>Graisse</label>
                      <select
                        value={selected.fontWeight ?? 600}
                        onChange={(e) => updateElement(selected.id, { fontWeight: Number(e.target.value) })}
                      >
                        {FONT_WEIGHTS.map((w) => (
                          <option key={w.value} value={w.value}>{w.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="design-prop-field-full">
                    <label>Alignement & Style</label>
                    <div className="design-text-actions">
                      {(["left", "center", "right"] as const).map((align) => (
                        <button
                          key={align}
                          type="button"
                          className={`design-fmt-btn${selected.textAlign === align ? " active" : ""}`}
                          onClick={() => updateElement(selected.id, { textAlign: align })}
                          title={align === "left" ? "Gauche" : align === "center" ? "Centre" : "Droite"}
                        >
                          {align === "left" ? <IconAlignLeft size={14} /> : align === "center" ? <IconAlignCenter size={14} /> : <IconAlignRight size={14} />}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`design-fmt-btn${selected.fontWeight && selected.fontWeight >= 700 ? " active" : ""}`}
                        onClick={() => updateElement(selected.id, { fontWeight: selected.fontWeight && selected.fontWeight >= 700 ? 400 : 700 })}
                        title="Gras"
                      >
                        <IconBold size={14} />
                      </button>
                      <button
                        type="button"
                        className={`design-fmt-btn${selected.fontStyle === "italic" ? " active" : ""}`}
                        onClick={() => updateElement(selected.id, { fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}
                        title="Italique"
                      >
                        <IconItalic size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="design-prop-grid2">
                    <div className="design-prop-field">
                      <label>Interligne</label>
                      <input
                        type="number" min={0.8} max={3} step={0.05}
                        value={selected.lineHeight ?? 1.25}
                        onChange={(e) => updateElement(selected.id, { lineHeight: Number(e.target.value) })}
                      />
                    </div>
                    <div className="design-prop-field">
                      <label>Espacement</label>
                      <input
                        type="number" min={-0.1} max={1} step={0.01}
                        value={selected.letterSpacing ?? 0}
                        onChange={(e) => updateElement(selected.id, { letterSpacing: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Shadow */}
              <div className="design-inspector-section">
                <div className="design-section-header"><span>Ombre</span></div>
                <div className="design-prop-field-full">
                  <div className="design-inline-row">
                    <input
                      type="checkbox"
                      id="shadow-toggle"
                      checked={!!selected.shadow && selected.shadow !== "none"}
                      onChange={(e) => updateElement(selected.id, {
                        shadow: e.target.checked ? "4px 6px 20px rgba(0,0,0,0.25)" : "none"
                      })}
                    />
                    <label htmlFor="shadow-toggle" style={{ cursor: "pointer" }}>Activer l&apos;ombre</label>
                  </div>
                  {selected.shadow && selected.shadow !== "none" ? (
                    <input
                      type="text"
                      value={selected.shadow}
                      className="design-shadow-input"
                      placeholder="4px 6px 20px rgba(0,0,0,0.25)"
                      onChange={(e) => updateElement(selected.id, { shadow: e.target.value }, true)}
                      onBlur={() => pushHistory(docRef.current)}
                    />
                  ) : null}
                </div>
              </div>

              {/* Layer order */}
              <div className="design-inspector-section">
                <div className="design-section-header"><span>Ordre des calques</span></div>
                <div className="design-action-row">
                  <button type="button" className="design-action-btn" onClick={() => layerAction("front")}>Devant tout</button>
                  <button type="button" className="design-action-btn" onClick={() => layerAction("up")}>Avancer</button>
                  <button type="button" className="design-action-btn" onClick={() => layerAction("down")}>Reculer</button>
                  <button type="button" className="design-action-btn" onClick={() => layerAction("back")}>Derrière tout</button>
                </div>
              </div>
            </div>
          ) : (
            /* No selection — page background */
            <div className="design-inspector-section">
              <div className="design-section-header"><span>Fond de page</span></div>
              <div className="design-prop-field-full">
                <label>Couleur</label>
                <div className="design-color-row">
                  <input
                    type="color"
                    value={doc.background.startsWith("#") ? doc.background : "#ffffff"}
                    onChange={(e) => updateDoc({ background: e.target.value })}
                  />
                  <span className="design-color-val">{doc.background.startsWith("#") ? doc.background.toUpperCase() : doc.background}</span>
                </div>
              </div>
              <div className="design-prop-field-full" style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                {doc.width} × {doc.height} px
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
