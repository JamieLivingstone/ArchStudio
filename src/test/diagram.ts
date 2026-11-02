import type { Connection, DiagramObject } from "../diagram/schema";
import { getAppState, loadDiagram, select } from "../ui/state";
import { diagramOf } from "./fixtures";

export * from "./fixtures";

export function seed(objects: DiagramObject[], connections: Connection[] = [], selection: string[] = []) {
  loadDiagram(diagramOf(objects, connections));
  select(selection);
}

export const diagram = () => getAppState().diagram;
export const selection = () => getAppState().selection;
export const undoLabels = () => getAppState().undoSteps.map((step) => step.label);
export const ids = () => diagram().objects.map((object) => object.id);
