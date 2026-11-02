import type { DiagramObject } from "../../../diagram/schema";

export const RECTANGLE_SIZE = { width: 160, height: 96 };
const COMPONENT_WIDTH = 224;
export const MIN_SPHERE_DIAMETER = 112;
export const BOUNDARY_SIZE = { width: 320, height: 200 };
export const BOUNDARY_MARGIN = 24;
export const BOUNDARY_HEADER = 48;
export const BOUNDARY_TITLE = 32;

export const estimatedSize: Record<DiagramObject["type"], { width: number; height: number }> = {
  text: { width: 60, height: 28 },
  rectangle: RECTANGLE_SIZE,
  sphere: { width: MIN_SPHERE_DIAMETER, height: MIN_SPHERE_DIAMETER },
  component: { width: COMPONENT_WIDTH, height: 60 },
  boundary: BOUNDARY_SIZE,
};
