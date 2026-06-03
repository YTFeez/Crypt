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
  { id: "youtube", name: "Miniature YouTube", width: 1280, height: 720, background: "#0f172a", category: "social" },
  { id: "twitter", name: "Bannière X (Twitter)", width: 1500, height: 500, background: "#15202b", category: "social" },
  { id: "facebook", name: "Post Facebook", width: 1200, height: 630, background: "#f0f2f5", category: "social" },
  { id: "business-card", name: "Carte de visite", width: 1050, height: 600, background: "#ffffff", category: "print" },
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
  hidden?: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  borderRadius?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  shadow?: string;
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
    fontStyle: partial.fontStyle ?? "normal",
    textAlign: partial.textAlign ?? "left",
    lineHeight: partial.lineHeight ?? 1.25,
    letterSpacing: partial.letterSpacing ?? 0,
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
      createElement("rect", { x: 0, y: 0, width: template.width, height: 120, fill: "#0866ff", zIndex: 0 }),
      createElement("text", {
        x: 64, y: 280, width: template.width - 128, height: 80,
        content: "Titre de la présentation", fontSize: 48, fontWeight: 700,
        fill: "#0f172a", textAlign: "left", zIndex: 2,
      }),
      createElement("text", {
        x: 64, y: 380, width: template.width - 128, height: 60,
        content: "Sous-titre ou message clé", fontSize: 24, fontWeight: 400,
        fill: "#64748b", zIndex: 2,
      })
    );
  } else if (template.id === "instagram") {
    elements.push(
      createElement("rect", { x: 0, y: 0, width: template.width, height: template.height, fill: "#667eea", zIndex: 0 }),
      createElement("text", {
        x: 80, y: 420, width: template.width - 160, height: 120,
        content: "Votre message ici", fontSize: 56, fontWeight: 700,
        fill: "#ffffff", textAlign: "center", zIndex: 2,
      })
    );
  } else if (template.id === "flyer") {
    elements.push(
      createElement("text", {
        x: 40, y: 48, width: template.width - 80, height: 72,
        content: "ÉVÉNEMENT", fontSize: 36, fontWeight: 800, fill: "#c2410c", zIndex: 1,
      }),
      createElement("text", {
        x: 40, y: 140, width: template.width - 80, height: 200,
        content: "Titre de votre flyer\nDate · Lieu · Détails", fontSize: 22, fontWeight: 500,
        fill: "#431407", lineHeight: 1.4, zIndex: 1,
      }),
      createElement("rect", { x: 40, y: 680, width: template.width - 80, height: 56, fill: "#ea580c", borderRadius: 12, zIndex: 1 }),
      createElement("text", {
        x: 40, y: 692, width: template.width - 80, height: 40,
        content: "En savoir plus", fontSize: 18, fontWeight: 700,
        fill: "#ffffff", textAlign: "center", zIndex: 2,
      })
    );
  } else if (template.id === "youtube") {
    elements.push(
      createElement("rect", { x: 0, y: 0, width: template.width, height: template.height, fill: "#0f172a", zIndex: 0 }),
      createElement("rect", { x: 0, y: 0, width: 8, height: template.height, fill: "#ff0000", zIndex: 1 }),
      createElement("text", {
        x: 60, y: 200, width: template.width - 120, height: 200,
        content: "TITRE DE LA VIDÉO", fontSize: 80, fontWeight: 900,
        fill: "#ffffff", textAlign: "left", zIndex: 2,
      }),
      createElement("text", {
        x: 60, y: 400, width: 600, height: 60,
        content: "Sous-titre descriptif", fontSize: 32, fontWeight: 400,
        fill: "#94a3b8", zIndex: 2,
      })
    );
  } else if (template.id === "twitter") {
    elements.push(
      createElement("rect", { x: 0, y: 0, width: template.width, height: template.height, fill: "#15202b", zIndex: 0 }),
      createElement("text", {
        x: 80, y: 160, width: template.width - 160, height: 120,
        content: "Votre bannière X", fontSize: 64, fontWeight: 800,
        fill: "#ffffff", textAlign: "center", zIndex: 2,
      }),
      createElement("text", {
        x: 80, y: 300, width: template.width - 160, height: 60,
        content: "@votrepseudo · Site web", fontSize: 28, fontWeight: 400,
        fill: "#64748b", textAlign: "center", zIndex: 2,
      })
    );
  } else if (template.id === "facebook") {
    elements.push(
      createElement("rect", { x: 0, y: 0, width: template.width, height: template.height, fill: "#1877f2", zIndex: 0 }),
      createElement("text", {
        x: 80, y: 220, width: template.width - 160, height: 120,
        content: "Votre publication", fontSize: 52, fontWeight: 700,
        fill: "#ffffff", textAlign: "center", zIndex: 2,
      })
    );
  } else if (template.id === "business-card") {
    elements.push(
      createElement("text", {
        x: 60, y: 80, width: 500, height: 80,
        content: "Prénom Nom", fontSize: 40, fontWeight: 700, fill: "#0f172a", zIndex: 1,
      }),
      createElement("text", {
        x: 60, y: 175, width: 500, height: 40,
        content: "Titre du poste", fontSize: 20, fontWeight: 400, fill: "#64748b", zIndex: 1,
      }),
      createElement("rect", { x: 60, y: 230, width: 180, height: 3, fill: "#0866ff", borderRadius: 2, zIndex: 1 }),
      createElement("text", {
        x: 60, y: 260, width: 500, height: 60,
        content: "email@exemple.com\n+33 6 00 00 00 00", fontSize: 16, fontWeight: 400,
        fill: "#475569", lineHeight: 1.8, zIndex: 1,
      })
    );
  } else if (template.id === "linkedin") {
    elements.push(
      createElement("rect", { x: 0, y: 0, width: template.width, height: template.height, fill: "#0a66c2", zIndex: 0 }),
      createElement("text", {
        x: 80, y: 140, width: template.width - 160, height: 80,
        content: "Votre bannière LinkedIn", fontSize: 48, fontWeight: 700,
        fill: "#ffffff", textAlign: "center", zIndex: 2,
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
