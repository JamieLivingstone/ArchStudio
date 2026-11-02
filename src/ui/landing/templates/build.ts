import type { LucideIcon } from "lucide-react";
import type { BoundaryKind } from "../../../diagram/boundaryKinds";
import type { ComponentKind } from "../../../diagram/componentKinds";
import {
  type Component,
  type Connection,
  type Diagram,
  type DiagramObject,
  SCHEMA_VERSION,
} from "../../../diagram/schema";
import { BOUNDARY_SIZE } from "../../canvas/nodes/sizes";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
  diagram: Diagram;
}

type Unplaced = DiagramObject extends infer T ? (T extends unknown ? Omit<T, "position" | "size"> : never) : never;
type Details = Partial<Pick<Component, "description" | "options" | "tags" | "structure" | "parent">>;

export const component = (id: string, kind: ComponentKind, name: string, details: Details = {}): Unplaced => ({
  type: "component",
  id,
  kind,
  name,
  options: {},
  ...details,
});

export const boundary = (id: string, name: string, kind?: BoundaryKind, parent?: string): Unplaced => ({
  type: "boundary",
  id,
  name,
  ...(kind && { kind }),
  ...(parent && { parent }),
});

export const external = (id: string, text: string, description: string, tags: string[]): Unplaced => ({
  type: "rectangle",
  id,
  text,
  description,
  tags,
});

export const connection = (from: string, to: string, label = "", line: Connection["line"] = "solid"): Connection => ({
  id: `${from}-${to}`,
  from,
  to,
  label,
  direction: "forward",
  line,
});

export function build(objects: Unplaced[], connections: Connection[]): Diagram {
  const position = { x: 0, y: 0 };
  return {
    schemaVersion: SCHEMA_VERSION,
    objects: objects.map((object) =>
      object.type === "boundary" ? { ...object, position, size: BOUNDARY_SIZE } : { ...object, position },
    ),
    connections,
  };
}
