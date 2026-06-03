import {
  IconType,
  IconSquare,
  IconCircle,
  IconTriangle,
  IconMinus,
  IconImage2,
  IconUndo,
  IconRedo,
  IconGrid,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconCopy,
  IconTrash,
} from "../Icons";
import type { DesignElementType } from "../../lib/design/types";

type AlignMode = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";

type Props = {
  onAdd: (type: DesignElementType) => void;
  onPickImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  snapGrid: boolean;
  onToggleSnap: () => void;
  hasSelection: boolean;
  onAlign: (mode: AlignMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const SHAPES: { id: DesignElementType | "image"; icon: React.ReactNode; label: string; hint: string }[] = [
  { id: "text",     icon: <IconType size={18} />,     label: "Texte",      hint: "Titres et paragraphes" },
  { id: "rect",     icon: <IconSquare size={18} />,   label: "Rectangle",  hint: "Bloc coloré ou bouton" },
  { id: "circle",   icon: <IconCircle size={18} />,   label: "Cercle",     hint: "Forme ronde / ellipse" },
  { id: "triangle", icon: <IconTriangle size={18} />, label: "Triangle",   hint: "Forme décorative" },
  { id: "line",     icon: <IconMinus size={18} />,    label: "Ligne",      hint: "Trait séparateur" },
  { id: "image",    icon: <IconImage2 size={18} />,   label: "Image",      hint: "Importer depuis votre ordinateur" },
];

const ALIGN_H: { mode: AlignMode; icon: React.ReactNode; label: string }[] = [
  { mode: "left",     icon: <IconAlignLeft size={14} />,   label: "Gauche" },
  { mode: "center-h", icon: <IconAlignCenter size={14} />, label: "Centre" },
  { mode: "right",    icon: <IconAlignRight size={14} />,  label: "Droite" },
];

const ALIGN_V_LABELS: { mode: AlignMode; label: string }[] = [
  { mode: "top",      label: "Haut" },
  { mode: "center-v", label: "Milieu" },
  { mode: "bottom",   label: "Bas" },
];

export function DesignToolPalette({
  onAdd,
  onPickImage,
  onUndo,
  onRedo,
  snapGrid,
  onToggleSnap,
  hasSelection,
  onAlign,
  onDuplicate,
  onDelete,
  canUndo,
  canRedo,
}: Props) {
  return (
    <div className="design-tool-palette">
      {/* Shapes */}
      <section className="design-palette-section">
        <h3 className="design-palette-title">Éléments</h3>
        <div className="design-tool-grid">
          {SHAPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="design-tool-btn"
              title={t.hint}
              onClick={() => (t.id === "image" ? onPickImage() : onAdd(t.id as DesignElementType))}
            >
              <span className="design-tool-icon" aria-hidden>{t.icon}</span>
              <span className="design-tool-label">{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Actions */}
      <section className="design-palette-section">
        <h3 className="design-palette-title">Actions</h3>
        <div className="design-action-row">
          <button
            type="button"
            className="design-action-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
          >
            <IconUndo size={16} />
            <span>Annuler</span>
          </button>
          <button
            type="button"
            className="design-action-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rétablir (Ctrl+Y)"
          >
            <IconRedo size={16} />
            <span>Rétablir</span>
          </button>
          <button
            type="button"
            className={`design-action-btn${snapGrid ? " active" : ""}`}
            onClick={onToggleSnap}
            title="Aimantation à la grille (10 px)"
          >
            <IconGrid size={16} />
            <span>Grille</span>
          </button>
        </div>
      </section>

      {/* Selection actions */}
      {hasSelection ? (
        <>
          <section className="design-palette-section">
            <h3 className="design-palette-title">Sélection</h3>
            <div className="design-action-row">
              <button type="button" className="design-action-btn" onClick={onDuplicate} title="Dupliquer (Ctrl+D)">
                <IconCopy size={16} />
                <span>Dupliquer</span>
              </button>
              <button type="button" className="design-action-btn design-action-danger" onClick={onDelete} title="Supprimer (Suppr)">
                <IconTrash size={16} />
                <span>Supprimer</span>
              </button>
            </div>
          </section>

          <section className="design-palette-section">
            <h3 className="design-palette-title">Aligner</h3>
            <div className="design-align-btns">
              {ALIGN_H.map((a) => (
                <button
                  key={a.mode}
                  type="button"
                  className="design-align-btn"
                  onClick={() => onAlign(a.mode)}
                  title={a.label}
                >
                  {a.icon}
                </button>
              ))}
              {ALIGN_V_LABELS.map((a) => (
                <button
                  key={a.mode}
                  type="button"
                  className="design-align-btn"
                  onClick={() => onAlign(a.mode)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* Shortcuts hint */}
      <section className="design-palette-section design-palette-hints">
        <h3 className="design-palette-title">Raccourcis</h3>
        <ul className="design-shortcut-list">
          <li><kbd>Ctrl+Z</kbd> Annuler</li>
          <li><kbd>Ctrl+D</kbd> Dupliquer</li>
          <li><kbd>Ctrl+C/V</kbd> Copier/Coller</li>
          <li><kbd>Suppr</kbd> Supprimer</li>
          <li><kbd>↑↓←→</kbd> Déplacer (×1px)</li>
          <li><kbd>Shift+↑↓</kbd> Déplacer ×10px</li>
          <li><kbd>Échap</kbd> Désélectionner</li>
        </ul>
      </section>
    </div>
  );
}
