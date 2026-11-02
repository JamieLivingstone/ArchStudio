import type { ComponentKind } from "../diagram/componentKinds";
import type { DiagramOperation } from "../diagram/operations";
import type { Boundary, Component, Connection, Diagram, DiagramObject } from "../diagram/schema";
import type { Issue } from "../diagram/validate";

type Changes = Extract<DiagramOperation, { type: "object.update" }>["changes"];

export function component(
  id: string,
  name = id,
  kind: ComponentKind = "loadBalancer",
  extra: Partial<Component> = {},
): Component {
  return { type: "component", id, position: { x: 0, y: 0 }, kind, name, options: {}, ...extra };
}

export function shape(
  id: string,
  text = id,
  type: "text" | "rectangle" | "sphere" = "rectangle",
  extra: Partial<DiagramObject> = {},
): DiagramObject {
  return { type, id, position: { x: 0, y: 0 }, text, ...extra } as DiagramObject;
}

export function boundary(id: string, extra: Partial<Boundary> = {}): Boundary {
  return { type: "boundary", id, position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, name: id, ...extra };
}

export function connection(id: string, from: string, to: string, label = "", extra: Partial<Connection> = {}) {
  return { id, from, to, label, direction: "forward", line: "solid", ...extra } satisfies Connection;
}

export function diagramOf(objects: DiagramObject[], connections: Connection[] = []): Diagram {
  return { schemaVersion: 1, objects, connections };
}

export const objectAdd = (object: DiagramObject): DiagramOperation => ({ type: "object.add", object });
export const objectUpdate = (id: string, changes: Changes): DiagramOperation => ({
  type: "object.update",
  id,
  changes,
});
export const objectRemove = (id: string): DiagramOperation => ({ type: "object.remove", id });
export const connectionAdd = (added: Connection): DiagramOperation => ({ type: "connection.add", connection: added });
export const connectionRemove = (id: string): DiagramOperation => ({ type: "connection.remove", id });

export const codes = (issues: Issue[]) => issues.map((issue) => issue.code);
