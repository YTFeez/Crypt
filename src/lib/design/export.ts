import { jsPDF } from "jspdf";
import type { DesignDoc } from "./types";
import type { ExportFormat, ExportQualityBoost } from "./formats";
import { EXPORT_QUALITY_SCALE } from "./formats";
import { canvasToBlob, renderDesignToCanvas } from "./render-canvas";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeName(name: string) {
  return name.replace(/[^\w\-àâäéèêëïîôùûüç\s]/gi, "").replace(/\s+/g, "-") || "document";
}

function elementToSvg(el: DesignDoc["elements"][0]): string {
  const rot = el.rotation ? ` transform="rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})"` : "";
  if (el.type === "rect") {
    return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" opacity="${el.opacity}" rx="${el.borderRadius ?? 0}"${rot}/>`;
  }
  if (el.type === "circle") {
    return `<ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fill}" opacity="${el.opacity}"${rot}/>`;
  }
  if (el.type === "triangle") {
    const x2 = el.x + el.width / 2;
    const y2 = el.y;
    const x3 = el.x + el.width;
    const y3 = el.y + el.height;
    const x4 = el.x;
    const y4 = el.y + el.height;
    return `<polygon points="${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="${el.fill}" opacity="${el.opacity}"${rot}/>`;
  }
  if (el.type === "text" && el.content) {
    const escaped = el.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<text x="${el.x}" y="${el.y + (el.fontSize ?? 24)}" fill="${el.fill}" font-size="${el.fontSize ?? 24}" font-family="${el.fontFamily ?? "Inter,sans-serif"}" opacity="${el.opacity}"${rot}>${escaped}</text>`;
  }
  if (el.type === "image" && el.src) {
    return `<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${el.opacity}"${rot}/>`;
  }
  return "";
}

export async function exportDesign(
  doc: DesignDoc,
  format: ExportFormat,
  qualityBoost: ExportQualityBoost = "1x"
): Promise<{ blob: Blob; filename: string }> {
  const base = safeName(doc.name);
  const scale = EXPORT_QUALITY_SCALE[qualityBoost];

  if (format === "json") {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    return { blob, filename: `${base}.talkeo.json` };
  }

  if (format === "svg") {
    const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
    const body = sorted.map(elementToSvg).join("\n");
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><rect width="100%" height="100%" fill="${doc.background}"/>${body}</svg>`;
    return { blob: new Blob([svg], { type: "image/svg+xml" }), filename: `${base}.svg` };
  }

  const canvas = await renderDesignToCanvas(doc, { scale });

  if (format === "png") {
    const blob = await canvasToBlob(canvas, "image/png");
    return { blob, filename: `${base}.png` };
  }
  if (format === "jpeg") {
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    return { blob, filename: `${base}.jpg` };
  }
  if (format === "webp") {
    const blob = await canvasToBlob(canvas, "image/webp", 0.9);
    return { blob, filename: `${base}.webp` };
  }

  if (format === "pdf") {
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const orientation = doc.width > doc.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
    const blob = pdf.output("blob");
    return { blob, filename: `${base}.pdf` };
  }

  throw new Error("Format inconnu");
}

/** @deprecated utilisez exportDesign */
export async function exportDesignToPng(doc: DesignDoc): Promise<Blob> {
  const { blob } = await exportDesign(doc, "png", "1x");
  return blob;
}
