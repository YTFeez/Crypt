import { useState } from "react";
import {
  A4_QUALITY_CHOICES,
  FORMAT_CATEGORIES,
  PAGE_FORMAT_CHOICES,
  resolveFormatDimensions,
  type PageFormatId,
  type PageQualityId,
} from "../../lib/design/formats";

type Props = {
  onClose: () => void;
  onCreate: (opts: {
    formatId: PageFormatId;
    qualityId?: PageQualityId;
    name: string;
    width: number;
    height: number;
    background: string;
  }) => void;
};

export function NewDocumentModal({ onClose, onCreate }: Props) {
  const [pickedFormat, setPickedFormat] = useState<PageFormatId | null>(null);
  const [qualityId, setQualityId] = useState<PageQualityId>("draft");

  const format = pickedFormat ? PAGE_FORMAT_CHOICES.find((f) => f.id === pickedFormat) : null;
  const needsQuality = format?.hasQualityPicker;

  function confirm() {
    if (!pickedFormat) return;
    const resolved = resolveFormatDimensions(pickedFormat, needsQuality ? qualityId : undefined);
    onCreate({
      formatId: pickedFormat,
      qualityId: needsQuality ? qualityId : undefined,
      name: resolved.label,
      width: resolved.width,
      height: resolved.height,
      background: resolved.background,
    });
  }

  return (
    <div className="design-modal-backdrop" onClick={onClose}>
      <div className="design-modal panel design-new-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header row" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>Nouveau document</strong>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              Choisissez un format dans la liste, puis validez.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="panel-body design-new-doc-body">
          {!pickedFormat ? (
            <div className="design-format-list">
              {FORMAT_CATEGORIES.map((cat) => {
                const items = PAGE_FORMAT_CHOICES.filter((f) => f.category === cat.id);
                if (!items.length) return null;
                return (
                  <section key={cat.id} className="design-format-section">
                    <h3>{cat.label}</h3>
                    <p className="muted design-format-section-hint">{cat.hint}</p>
                    <ul>
                      {items.map((f) => (
                        <li key={f.id}>
                          <button type="button" className="design-format-row" onClick={() => setPickedFormat(f.id)}>
                            <span
                              className="design-format-thumb"
                              style={{
                                aspectRatio: `${f.defaultWidth} / ${f.defaultHeight}`,
                                background: f.defaultBackground,
                              }}
                            />
                            <span className="design-format-row-text">
                              <strong>{f.name}</strong>
                              <span>{f.description}</span>
                              <span className="design-format-size">
                                {f.defaultWidth} × {f.defaultHeight} px
                                {f.hasQualityPicker ? " · qualité réglable" : ""}
                              </span>
                            </span>
                            <span className="design-format-arrow" aria-hidden>
                              →
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="design-format-step2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPickedFormat(null)}>
                ← Retour aux formats
              </button>
              <h3 style={{ margin: "1rem 0 0.35rem" }}>{format?.name}</h3>
              <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
                {format?.description}
              </p>

              {needsQuality ? (
                <>
                  <p className="design-step-label">Qualité du document A4</p>
                  <ul className="design-quality-list">
                    {A4_QUALITY_CHOICES.map((q) => (
                      <li key={q.id}>
                        <label className={`design-quality-option${qualityId === q.id ? " active" : ""}`}>
                          <input
                            type="radio"
                            name="a4quality"
                            checked={qualityId === q.id}
                            onChange={() => setQualityId(q.id)}
                          />
                          <span>
                            <strong>{q.name}</strong>
                            <span className="muted">{q.description}</span>
                            <span className="design-format-size">
                              {q.width} × {q.height} px · {q.dpi} DPI
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">
                  Taille : {format?.defaultWidth} × {format?.defaultHeight} px
                </p>
              )}

              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: "1.25rem" }} onClick={confirm}>
                Créer ce document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
