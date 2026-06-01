import type { DesignElement } from "./types";

export function alignElements(
  elements: DesignElement[],
  ids: string[],
  mode: "left" | "center-h" | "right" | "top" | "center-v" | "bottom",
  page?: { width: number; height: number }
): DesignElement[] {
  const selected = elements.filter((e) => ids.includes(e.id));
  if (selected.length === 1 && page) {
    const e = selected[0]!;
    let patch: Partial<DesignElement> = {};
    if (mode === "left") patch = { x: 0 };
    if (mode === "right") patch = { x: page.width - e.width };
    if (mode === "center-h") patch = { x: (page.width - e.width) / 2 };
    if (mode === "top") patch = { y: 0 };
    if (mode === "bottom") patch = { y: page.height - e.height };
    if (mode === "center-v") patch = { y: (page.height - e.height) / 2 };
    return elements.map((el) => (el.id === e.id ? { ...el, ...patch } : el));
  }
  if (selected.length < 2) return elements;

  const minX = Math.min(...selected.map((e) => e.x));
  const maxX = Math.max(...selected.map((e) => e.x + e.width));
  const minY = Math.min(...selected.map((e) => e.y));
  const maxY = Math.max(...selected.map((e) => e.y + e.height));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return elements.map((e) => {
    if (!ids.includes(e.id)) return e;
    switch (mode) {
      case "left":
        return { ...e, x: minX };
      case "right":
        return { ...e, x: maxX - e.width };
      case "center-h":
        return { ...e, x: midX - e.width / 2 };
      case "top":
        return { ...e, y: minY };
      case "bottom":
        return { ...e, y: maxY - e.height };
      case "center-v":
        return { ...e, y: midY - e.height / 2 };
      default:
        return e;
    }
  });
}

export function snapValue(v: number, grid = 10): number {
  return Math.round(v / grid) * grid;
}
