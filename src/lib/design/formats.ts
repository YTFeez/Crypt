/** Formats papier et qualités d'export (DPI effectif) */

export type PageQualityId = "draft" | "standard" | "print" | "hd" | "web";

export type PageFormatId = "a4" | "a5" | "letter" | "presentation" | "instagram" | "story" | "linkedin";

export type PageFormatOption = {
  formatId: PageFormatId;
  qualityId: PageQualityId;
  name: string;
  width: number;
  height: number;
  dpi: number;
  background: string;
  category: "print" | "social" | "presentation";
};

/** A4 à 96 DPI = 794×1123 ; qualités = multiplicateur linéaire */
const A4_BASE = { w: 794, h: 1123 };

function a4Size(quality: PageQualityId): { width: number; height: number; dpi: number } {
  const scales: Record<PageQualityId, { s: number; dpi: number }> = {
    web: { s: 0.75, dpi: 72 },
    draft: { s: 1, dpi: 96 },
    standard: { s: 1240 / A4_BASE.w, dpi: 150 },
    print: { s: 2480 / A4_BASE.w, dpi: 300 },
    hd: { s: 3508 / A4_BASE.h, dpi: 300 },
  };
  const { s, dpi } = scales[quality];
  return { width: Math.round(A4_BASE.w * s), height: Math.round(A4_BASE.h * s), dpi };
}

export const PAGE_FORMAT_OPTIONS: PageFormatOption[] = [
  ...(["draft", "standard", "print", "hd", "web"] as PageQualityId[]).map((q) => {
    const { width, height, dpi } = a4Size(q);
    const labels: Record<PageQualityId, string> = {
      web: "Web léger (72 DPI)",
      draft: "Brouillon (96 DPI)",
      standard: "Standard (150 DPI)",
      print: "Impression (300 DPI)",
      hd: "Haute définition (300 DPI+)",
    };
    return {
      formatId: "a4" as const,
      qualityId: q,
      name: `A4 — ${labels[q]}`,
      width,
      height,
      dpi,
      background: "#ffffff",
      category: "print" as const,
    };
  }),
  {
    formatId: "a5",
    qualityId: "standard",
    name: "A5 — Standard",
    width: 559,
    height: 794,
    dpi: 150,
    background: "#ffffff",
    category: "print",
  },
  {
    formatId: "letter",
    qualityId: "standard",
    name: "US Letter — Standard",
    width: 816,
    height: 1056,
    dpi: 150,
    background: "#ffffff",
    category: "print",
  },
  {
    formatId: "presentation",
    qualityId: "draft",
    name: "Présentation 16:9",
    width: 1280,
    height: 720,
    dpi: 96,
    background: "#ffffff",
    category: "presentation",
  },
  {
    formatId: "instagram",
    qualityId: "print",
    name: "Post Instagram (1080²)",
    width: 1080,
    height: 1080,
    dpi: 300,
    background: "#ffffff",
    category: "social",
  },
  {
    formatId: "story",
    qualityId: "print",
    name: "Story (1080×1920)",
    width: 1080,
    height: 1920,
    dpi: 300,
    background: "#1a1a2e",
    category: "social",
  },
  {
    formatId: "linkedin",
    qualityId: "standard",
    name: "Bannière LinkedIn",
    width: 1584,
    height: 396,
    dpi: 150,
    background: "#0a66c2",
    category: "social",
  },
];

export type ExportFormat = "png" | "jpeg" | "pdf" | "svg" | "json" | "webp";

export type ExportQualityBoost = "1x" | "1.5x" | "2x" | "3x";

export const EXPORT_QUALITY_SCALE: Record<ExportQualityBoost, number> = {
  "1x": 1,
  "1.5x": 1.5,
  "2x": 2,
  "3x": 3,
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG (transparent)",
  jpeg: "JPEG (photo)",
  pdf: "PDF (impression)",
  svg: "SVG (vectoriel)",
  json: "Projet JSON (.talkeo)",
  webp: "WebP (léger)",
};
