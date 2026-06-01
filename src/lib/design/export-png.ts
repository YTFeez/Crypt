import type { DesignDoc, DesignElement } from "./types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function parseGradient(fill: string): CanvasGradient | string {
  if (!fill.startsWith("linear-gradient")) return fill;
  const m = fill.match(/linear-gradient\((\d+)deg,\s*([^,]+)\s+\d+%,\s*([^)]+)\s+\d+%\)/);
  if (!m) return "#667eea";
  return m[2].trim();
}

function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement) {
  ctx.save();
  ctx.globalAlpha = el.opacity;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  if (el.type === "rect") {
    ctx.fillStyle = parseGradient(el.fill);
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
    }
    const r = el.borderRadius ?? 0;
    if (r > 0) {
      roundRect(ctx, el.x, el.y, el.width, el.height, r);
      ctx.fill();
      if (el.strokeWidth > 0) ctx.stroke();
    } else {
      ctx.fillRect(el.x, el.y, el.width, el.height);
      if (el.strokeWidth > 0) ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
  } else if (el.type === "circle") {
    ctx.beginPath();
    ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth;
      ctx.stroke();
    }
  } else if (el.type === "line") {
    ctx.strokeStyle = el.stroke || el.fill;
    ctx.lineWidth = el.strokeWidth || 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(el.x, el.y + el.height / 2);
    ctx.lineTo(el.x + el.width, el.y + el.height / 2);
    ctx.stroke();
  } else if (el.type === "text" && el.content) {
    const weight = el.fontWeight ?? 600;
    const size = el.fontSize ?? 24;
    ctx.font = `${weight} ${size}px ${el.fontFamily ?? "Inter, sans-serif"}`;
    ctx.fillStyle = el.fill;
    ctx.textBaseline = "top";
    const lines = el.content.split("\n");
    const lh = (el.lineHeight ?? 1.25) * size;
    lines.forEach((line, i) => {
      let tx = el.x;
      if (el.textAlign === "center") tx = el.x + el.width / 2;
      else if (el.textAlign === "right") tx = el.x + el.width;
      ctx.textAlign = el.textAlign ?? "left";
      ctx.fillText(line, tx, el.y + i * lh);
    });
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function exportDesignToPng(doc: DesignDoc): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = doc.width;
  canvas.height = doc.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = doc.background;
  ctx.fillRect(0, 0, doc.width, doc.height);

  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    if (el.type === "image" && el.src) {
      try {
        const img = await loadImage(el.src);
        ctx.save();
        ctx.globalAlpha = el.opacity;
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
        ctx.restore();
      } catch {
        /* ignore broken image */
      }
    } else {
      drawElement(ctx, el);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export échoué"))), "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
