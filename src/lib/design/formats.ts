/** Formats de page et options d'export */

export type PageQualityId = "draft" | "standard" | "print";

export type PageFormatId =
  | "a4"
  | "a5"
  | "presentation"
  | "instagram"
  | "story"
  | "linkedin"
  | "flyer";

export type FormatCategory = "print" | "social" | "presentation";

export type PageFormatChoice = {
  id: PageFormatId;
  name: string;
  description: string;
  category: FormatCategory;
  /** Si défini, l'utilisateur choisit une qualité (ex. A4) */
  hasQualityPicker?: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultBackground: string;
};

export type QualityChoice = {
  id: PageQualityId;
  name: string;
  description: string;
  width: number;
  height: number;
  dpi: number;
};

const A4_BASE = { w: 794, h: 1123 };

export const FORMAT_CATEGORIES: { id: FormatCategory; label: string; hint: string }[] = [
  { id: "print", label: "Documents & print", hint: "A4, flyers, documents à imprimer" },
  { id: "social", label: "Réseaux sociaux", hint: "Posts, stories, bannières" },
  { id: "presentation", label: "Présentation", hint: "Écrans et diapositives" },
];

/** Formats proposés à la création (défauts simples) */
export const PAGE_FORMAT_CHOICES: PageFormatChoice[] = [
  {
    id: "a4",
    name: "Document A4",
    description: "Format papier standard — idéal pour PDF et impression",
    category: "print",
    hasQualityPicker: true,
    defaultWidth: A4_BASE.w,
    defaultHeight: A4_BASE.h,
    defaultBackground: "#ffffff",
  },
  {
    id: "flyer",
    name: "Flyer A5",
    description: "Format compact pour affiches et flyers",
    category: "print",
    defaultWidth: 559,
    defaultHeight: 794,
    defaultBackground: "#fff7ed",
  },
  {
    id: "presentation",
    name: "Présentation 16:9",
    description: "Format écran pour réunions et vidéos",
    category: "presentation",
    defaultWidth: 1280,
    defaultHeight: 720,
    defaultBackground: "#ffffff",
  },
  {
    id: "instagram",
    name: "Post Instagram (carré)",
    description: "Publication carrée 1080 × 1080 px",
    category: "social",
    defaultWidth: 1080,
    defaultHeight: 1080,
    defaultBackground: "#ffffff",
  },
  {
    id: "story",
    name: "Story / Reels (vertical)",
    description: "Format vertical plein écran",
    category: "social",
    defaultWidth: 1080,
    defaultHeight: 1920,
    defaultBackground: "#1a1a2e",
  },
  {
    id: "linkedin",
    name: "Bannière LinkedIn",
    description: "Couverture de profil ou page entreprise",
    category: "social",
    defaultWidth: 1584,
    defaultHeight: 396,
    defaultBackground: "#0a66c2",
  },
];

/** Qualités A4 — choix secondaire uniquement pour le format A4 */
export const A4_QUALITY_CHOICES: QualityChoice[] = [
  {
    id: "draft",
    name: "Standard (recommandé)",
    description: "Taille par défaut, rapide à éditer — 96 DPI",
    width: A4_BASE.w,
    height: A4_BASE.h,
    dpi: 96,
  },
  {
    id: "standard",
    name: "Qualité moyenne",
    description: "Bon compromis pour documents détaillés — 150 DPI",
    width: 1240,
    height: 1754,
    dpi: 150,
  },
  {
    id: "print",
    name: "Haute qualité impression",
    description: "Pour l'impression professionnelle — 300 DPI",
    width: 2480,
    height: 3508,
    dpi: 300,
  },
];

export function resolveFormatDimensions(
  formatId: PageFormatId,
  qualityId?: PageQualityId
): { width: number; height: number; dpi: number; background: string; label: string } {
  const base = PAGE_FORMAT_CHOICES.find((f) => f.id === formatId)!;
  if (formatId === "a4" && qualityId) {
    const q = A4_QUALITY_CHOICES.find((x) => x.id === qualityId) ?? A4_QUALITY_CHOICES[0]!;
    return {
      width: q.width,
      height: q.height,
      dpi: q.dpi,
      background: base.defaultBackground,
      label: `${base.name} — ${q.name}`,
    };
  }
  return {
    width: base.defaultWidth,
    height: base.defaultHeight,
    dpi: 96,
    background: base.defaultBackground,
    label: base.name,
  };
}

export type ExportFormat = "png" | "jpeg" | "pdf" | "svg" | "json" | "webp";

export type ExportQualityBoost = "1x" | "1.5x" | "2x";

export const EXPORT_QUALITY_SCALE: Record<ExportQualityBoost, number> = {
  "1x": 1,
  "1.5x": 1.5,
  "2x": 2,
};

export const EXPORT_FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  hint: string;
}[] = [
  { id: "png", label: "PNG", hint: "Meilleure qualité, fond transparent possible" },
  { id: "jpeg", label: "JPEG", hint: "Fichier léger, idéal pour photos" },
  { id: "pdf", label: "PDF", hint: "À envoyer ou imprimer (recommandé pour A4)" },
  { id: "webp", label: "WebP", hint: "Très léger pour le web" },
  { id: "svg", label: "SVG", hint: "Formes vectorielles (texte simplifié)" },
  { id: "json", label: "Projet Talkeo", hint: "Sauvegarde pour rouvrir plus tard" },
];

export const EXPORT_QUALITY_OPTIONS: {
  id: ExportQualityBoost;
  label: string;
  hint: string;
}[] = [
  { id: "1x", label: "Normale", hint: "Même taille que le canevas (défaut)" },
  { id: "1.5x", label: "Renforcée", hint: "50 % plus de détails" },
  { id: "2x", label: "Maximale", hint: "Double résolution pour impression" },
];

/** @deprecated utilisez PAGE_FORMAT_CHOICES */
export type PageFormatOption = {
  formatId: string;
  qualityId: string;
  name: string;
  width: number;
  height: number;
  dpi: number;
  background: string;
  category: FormatCategory;
};

export const PAGE_FORMAT_OPTIONS: PageFormatOption[] = PAGE_FORMAT_CHOICES.map((f) => {
  const d = resolveFormatDimensions(f.id, f.id === "a4" ? "draft" : undefined);
  return {
    formatId: f.id,
    qualityId: f.id === "a4" ? "draft" : "standard",
    name: d.label,
    width: d.width,
    height: d.height,
    dpi: d.dpi,
    background: d.background,
    category: f.category,
  };
});
