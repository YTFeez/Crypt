import type { DesignDoc, DesignElement } from "./types";

export type RenderOptions = { scale?: number };

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

export function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement, scale: number) {
  ctx.save();
  ctx.globalAlpha = el.opacity;
  const x = el.x * scale;
  const y = el.y * scale;
  const w = el.width * scale;
  const h = el.height * scale;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  if (el.type === "rect") {
    ctx.fillStyle = parseGradient(el.fill);
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth * scale;
    }
    const r = (el.borderRadius ?? 0) * scale;
    if (r > 0) {
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      if (el.strokeWidth > 0) ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      if (el.strokeWidth > 0) ctx.strokeRect(x, y, w, h);
    }
  } else if (el.type === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth * scale;
      ctx.stroke();
    }
  } else if (el.type === "triangle") {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = el.fill;
    ctx.fill();
    if (el.strokeWidth > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeWidth * scale;
      ctx.stroke();
    }
  } else if (el.type === "line") {
    ctx.strokeStyle = el.stroke || el.fill;
    ctx.lineWidth = (el.strokeWidth || 4) * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
  } else if (el.type === "text" && el.content) {
    const size = (el.fontSize ?? 24) * scale;
    const weight = el.fontWeight ?? 600;
    ctx.font = `${weight} ${size}px ${el.fontFamily ?? "Inter, sans-serif"}`;
    ctx.fillStyle = el.fill;
    ctx.textBaseline = "top";
    const lines = el.content.split("\n");
    const lh = (el.lineHeight ?? 1.25) * size;
    lines.forEach((line, i) => {
      let tx = x;
      if (el.textAlign === "center") tx = x + w / 2;
      else if (el.textAlign === "right") tx = x + w;
      ctx.textAlign = el.textAlign ?? "left";
      ctx.fillText(line, tx, y + i * lh);
    });
  }
  ctx.restore();
}

export async function renderDesignToCanvas(
  doc: DesignDoc,
  opts?: RenderOptions
): Promise<HTMLCanvasElement> {
  const scale = opts?.scale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(doc.width * scale);
  canvas.height = Math.round(doc.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.fillStyle = doc.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const el of sorted) {
    if (el.type === "image" && el.src) {
      try {
        const img = await loadImage(el.src);
        ctx.save();
        ctx.globalAlpha = el.opacity;
        const x = el.x * scale;
        const y = el.y * scale;
        const w = el.width * scale;
        const h = el.height * scale;
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch {
        /* ignore */
      }
    } else {
      drawElement(ctx, el, scale);
    }
  }
  return canvas;
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export échoué"))), type, quality);
  });
}
