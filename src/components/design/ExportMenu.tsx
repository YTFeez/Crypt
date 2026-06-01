import { useState } from "react";
import type { DesignDoc } from "../../lib/design/types";
import {
  EXPORT_FORMAT_OPTIONS,
  EXPORT_QUALITY_OPTIONS,
  EXPORT_QUALITY_SCALE,
  type ExportFormat,
  type ExportQualityBoost,
} from "../../lib/design/formats";
import { downloadBlob, exportDesign } from "../../lib/design/export";

type Props = { doc: DesignDoc };

export function ExportMenu({ doc }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [boost, setBoost] = useState<ExportQualityBoost>("1x");
  const [busy, setBusy] = useState(false);

  async function runExport() {
    setBusy(true);
    try {
      const { blob, filename } = await exportDesign(doc, format, boost);
      downloadBlob(blob, filename);
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-menu-wrap">
      <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen((o) => !o)}>
        Télécharger ▾
      </button>
      {open ? (
        <div className="export-menu-panel">
          <p className="export-menu-title">Choisir le format de fichier</p>
          {EXPORT_FORMAT_OPTIONS.map((f) => (
            <label key={f.id} className={`export-menu-option${format === f.id ? " active" : ""}`}>
              <input type="radio" name="fmt" checked={format === f.id} onChange={() => setFormat(f.id)} />
              <span>
                <strong>{f.label}</strong>
                <span className="muted">{f.hint}</span>
              </span>
            </label>
          ))}
          {format !== "json" && format !== "svg" ? (
            <>
              <p className="export-menu-title" style={{ marginTop: "0.85rem" }}>
                Définition à l&apos;export
              </p>
              <p className="muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>
                Par défaut : même taille que le canevas ({doc.width}×{doc.height} px).
              </p>
              {EXPORT_QUALITY_OPTIONS.map((q) => (
                <label key={q.id} className={`export-menu-option${boost === q.id ? " active" : ""}`}>
                  <input type="radio" name="boost" checked={boost === q.id} onChange={() => setBoost(q.id)} />
                  <span>
                    <strong>{q.label}</strong>
                    <span className="muted">{q.hint}</span>
                    <span className="design-format-size">
                      → {Math.round(doc.width * EXPORT_QUALITY_SCALE[q.id])}×
                      {Math.round(doc.height * EXPORT_QUALITY_SCALE[q.id])} px
                    </span>
                  </span>
                </label>
              ))}
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-block btn-sm"
            style={{ marginTop: "0.85rem" }}
            disabled={busy}
            onClick={() => void runExport()}
          >
            {busy ? "Export en cours…" : `Exporter en ${EXPORT_FORMAT_OPTIONS.find((x) => x.id === format)?.label}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
