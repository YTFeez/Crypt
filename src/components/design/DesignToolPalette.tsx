import type { DesignElementType } from "../../lib/design/types";

export type ToolDef = {
  id: DesignElementType | "image";
  icon: string;
  label: string;
  hint: string;
};

const ADD_TOOLS: ToolDef[] = [
  { id: "text", icon: "T", label: "Texte", hint: "Titres et paragraphes — double-clic pour modifier" },
  { id: "rect", icon: "▢", label: "Rectangle", hint: "Bloc coloré, bouton ou fond" },
  { id: "circle", icon: "○", label: "Cercle", hint: "Forme ronde / ellipse" },
  { id: "triangle", icon: "△", label: "Triangle", hint: "Forme pointue décorative" },
  { id: "line", icon: "—", label: "Ligne", hint: "Trait horizontal ou séparateur" },
  { id: "image", icon: "🖼", label: "Image", hint: "Importer depuis votre ordinateur" },
];

type Props = {
  onAdd: (type: DesignElementType) => void;
  onPickImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  snapGrid: boolean;
  onToggleSnap: () => void;
  hasSelection: boolean;
  onAlign: (mode: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
};

export function DesignToolPalette({
  onAdd,
  onPickImage,
  onUndo,
  onRedo,
  snapGrid,
  onToggleSnap,
  hasSelection,
  onAlign,
}: Props) {
  return (
    <div className="design-tool-palette">
      <section className="design-palette-section">
        <h3>Ajouter un élément</h3>
        <p className="design-palette-hint">Cliquez sur un outil, puis déplacez sur le canevas.</p>
        <div className="design-tool-grid">
          {ADD_TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="design-tool-btn"
              onClick={() => (t.id === "image" ? onPickImage() : onAdd(t.id as DesignElementType))}
            >
              <span className="design-tool-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="design-tool-label">{t.label}</span>
              <span className="design-tool-desc">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="design-palette-section">
        <h3>Actions</h3>
        <div className="design-tool-row-btns">
          <button type="button" className="btn btn-sm btn-ghost design-action-btn" onClick={onUndo} title="Ctrl+Z">
            <span>↶</span>
            <span>Annuler</span>
          </button>
          <button type="button" className="btn btn-sm btn-ghost design-action-btn" onClick={onRedo} title="Ctrl+Y">
            <span>↷</span>
            <span>Rétablir</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm design-action-btn ${snapGrid ? "btn-primary" : "btn-ghost"}`}
            onClick={onToggleSnap}
          >
            <span>⊞</span>
            <span>Grille {snapGrid ? "on" : "off"}</span>
          </button>
        </div>
        <p className="design-palette-hint">La grille aligne les éléments tous les 10 px.</p>
      </section>

      {hasSelection ? (
        <section className="design-palette-section">
          <h3>Aligner la sélection</h3>
          <p className="design-palette-hint">Position sur la page (élément sélectionné).</p>
          <div className="design-align-grid">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("left")}>
              Gauche
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("center-h")}>
              Centre H
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("right")}>
              Droite
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("top")}>
              Haut
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("center-v")}>
              Milieu V
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAlign("bottom")}>
              Bas
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
