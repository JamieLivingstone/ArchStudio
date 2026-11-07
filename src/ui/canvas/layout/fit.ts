import type { Size } from "../../../diagram/schema";
import type { Box } from "./route";

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Diagrams read left to right, so one too big to fit at a readable zoom starts from its left edge.
export function fitViewport(
  bounds: Box,
  pane: Size,
  padding: Padding,
  { minZoom, maxZoom }: { minZoom: number; maxZoom: number },
) {
  const width = Math.max(1, pane.width - padding.left - padding.right);
  const height = Math.max(1, pane.height - padding.top - padding.bottom);
  const fitting = Math.min(width / Math.max(1, bounds.width), height / Math.max(1, bounds.height));
  const zoom = Math.min(maxZoom, Math.max(minZoom, fitting));
  const spare = (room: number, size: number) => Math.max(0, (room - size * zoom) / 2);
  return {
    x: padding.left + spare(width, bounds.width) - bounds.x * zoom,
    y: padding.top + spare(height, bounds.height) - bounds.y * zoom,
    zoom,
  };
}
