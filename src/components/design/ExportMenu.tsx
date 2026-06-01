import { useState } from "react";
import type { DesignDoc } from "../../lib/design/types";
import {
  EXPORT_FORMAT_LABELS,
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
        Exporter ▾
      </button>
      {open ? (
        <div className="export-menu-panel">
          <p className="export-menu-title">Format</p>
          {(Object.keys(EXPORT_FORMAT_LABELS) as ExportFormat[]).map((f) => (
            <label key={f} className="export-menu-option">
              <input type="radio" name="fmt" checked={format === f} onChange={() => setFormat(f)} />
              {EXPORT_FORMAT_LABELS[f]}
            </label>
          ))}
          {format !== "json" && format !== "svg" ? (
            <>
              <p className="export-menu-title" style={{ marginTop: "0.75rem" }}>
                Résolution d&apos;export
              </p>
              {(Object.keys(EXPORT_QUALITY_SCALE) as ExportQualityBoost[]).map((q) => (
                <label key={q} className="export-menu-option">
                  <input type="radio" name="boost" checked={boost === q} onChange={() => setBoost(q)} />
                  {q} ({Math.round(doc.width * EXPORT_QUALITY_SCALE[q])}×
                  {Math.round(doc.height * EXPORT_QUALITY_SCALE[q])} px)
                </label>
              ))}
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-block btn-sm"
            style={{ marginTop: "0.75rem" }}
            disabled={busy}
            onClick={() => void runExport()}
          >
            {busy ? "Export…" : "Télécharger"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
