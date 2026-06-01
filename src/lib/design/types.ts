import { randomUuid } from "../secure-random";

export type DesignTemplate = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  category: "social" | "print" | "presentation" | "custom";
};

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  { id: "a4", name: "Document A4", width: 794, height: 1123, background: "#ffffff", category: "print" },
  { id: "presentation", name: "Présentation 16:9", width: 1280, height: 720, background: "#ffffff", category: "presentation" },
  { id: "instagram", name: "Post carré", width: 1080, height: 1080, background: "#ffffff", category: "social" },
  { id: "story", name: "Story vertical", width: 1080, height: 1920, background: "#1a1a2e", category: "social" },
  { id: "linkedin", name: "Bannière LinkedIn", width: 1584, height: 396, background: "#0a66c2", category: "social" },
  { id: "flyer", name: "Flyer A5", width: 559, height: 794, background: "#fff7ed", category: "print" },
];

export type DesignElementType = "text" | "rect" | "circle" | "triangle" | "image" | "line";

export type DesignElement = {
  id: string;
  type: DesignElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked?: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  borderRadius?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  src?: string;
};

export type DesignDoc = {
  id: string;
  owner_id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  elements: DesignElement[];
  is_shared: boolean;
  updated_at: string;
  created_at: string;
  archived_at?: string | null;
  page_quality?: string;
};

export function createElement(
  type: DesignElementType,
  partial: Partial<DesignElement> & Pick<DesignElement, "x" | "y" | "width" | "height">
): DesignElement {
  const base: DesignElement = {
    id: randomUuid(),
    type,
    x: partial.x,
    y: partial.y,
    width: partial.width,
    height: partial.height,
    rotation: partial.rotation ?? 0,
    zIndex: partial.zIndex ?? 1,
    opacity: partial.opacity ?? 1,
    fill: partial.fill ?? "#0f172a",
    stroke: partial.stroke ?? "transparent",
    strokeWidth: partial.strokeWidth ?? 0,
    borderRadius: partial.borderRadius,
    content: partial.content,
    fontSize: partial.fontSize,
    fontFamily: partial.fontFamily ?? "Inter, system-ui, sans-serif",
    fontWeight: partial.fontWeight ?? 600,
    textAlign: partial.textAlign ?? "left",
    lineHeight: partial.lineHeight ?? 1.25,
    src: partial.src,
  };
  return { ...base, ...partial, id: partial.id ?? base.id };
}

export function createDesignFromFormat(
  ownerId: string,
  format: { width: number; height: number; background: string; name: string; qualityId?: string },
  name?: string
): DesignDoc {
  const templateLike: DesignTemplate = {
    id: "custom",
    name: format.name,
    width: format.width,
    height: format.height,
    background: format.background,
    category: "print",
  };
  const doc = createDesignFromTemplate(ownerId, templateLike, name ?? format.name);
  return { ...doc, page_quality: format.qualityId };
}

export function createDesignFromTemplate(
  ownerId: string,
  template: DesignTemplate,
  name?: string
): DesignDoc {
  const now = new Date().toISOString();
  const elements: DesignElement[] = [];

  if (template.id === "presentation") {
    elements.push(
      createElement("rect", {
        x: 0,
        y: 0,
        width: template.width,
        height: 120,
        fill: "#0866ff",
        zIndex: 0,
      }),
      createElement("text", {
        x: 64,
        y: 280,
        width: template.width - 128,
        height: 80,
        content: "Titre de la présentation",
        fontSize: 48,
        fontWeight: 700,
        fill: "#0f172a",
        textAlign: "left",
        zIndex: 2,
      }),
      createElement("text", {
        x: 64,
        y: 380,
        width: template.width - 128,
        height: 60,
        content: "Sous-titre ou message clé",
        fontSize: 24,
        fontWeight: 400,
        fill: "#64748b",
        zIndex: 2,
      })
    );
  } else if (template.id === "instagram") {
    elements.push(
      createElement("rect", {
        x: 0,
        y: 0,
        width: template.width,
        height: template.height,
        fill: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        zIndex: 0,
      }),
      createElement("text", {
        x: 80,
        y: 420,
        width: template.width - 160,
        height: 120,
        content: "Votre message ici",
        fontSize: 56,
        fontWeight: 700,
        fill: "#ffffff",
        textAlign: "center",
        zIndex: 2,
      })
    );
  } else if (template.id === "flyer") {
    elements.push(
      createElement("text", {
        x: 40,
        y: 48,
        width: template.width - 80,
        height: 72,
        content: "ÉVÉNEMENT",
        fontSize: 36,
        fontWeight: 800,
        fill: "#c2410c",
        zIndex: 1,
      }),
      createElement("text", {
        x: 40,
        y: 140,
        width: template.width - 80,
        height: 200,
        content: "Titre de votre flyer\nDate · Lieu · Détails",
        fontSize: 22,
        fontWeight: 500,
        fill: "#431407",
        lineHeight: 1.4,
        zIndex: 1,
      }),
      createElement("rect", {
        x: 40,
        y: 680,
        width: template.width - 80,
        height: 56,
        fill: "#ea580c",
        borderRadius: 12,
        zIndex: 1,
      }),
      createElement("text", {
        x: 40,
        y: 692,
        width: template.width - 80,
        height: 40,
        content: "En savoir plus",
        fontSize: 18,
        fontWeight: 700,
        fill: "#ffffff",
        textAlign: "center",
        zIndex: 2,
      })
    );
  }

  return {
    id: randomUuid(),
    owner_id: ownerId,
    name: name ?? template.name,
    width: template.width,
    height: template.height,
    background: template.background,
    elements,
    is_shared: false,
    updated_at: now,
    created_at: now,
  };
}

export function nextZIndex(elements: DesignElement[]): number {
  if (!elements.length) return 1;
  return Math.max(...elements.map((e) => e.zIndex)) + 1;
}

export function duplicateElement(el: DesignElement): DesignElement {
  return {
    ...el,
    id: randomUuid(),
    x: el.x + 24,
    y: el.y + 24,
    zIndex: el.zIndex + 1,
  };
}
