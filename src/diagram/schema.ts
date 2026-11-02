import { z } from "zod";
import { boundaryKindNames } from "./boundaryKinds";
import { componentKindNames } from "./componentKinds";
import { databaseStructureSchema } from "./databaseStructure";

export const idSchema = z.string().min(1);
export const positionSchema = z.object({ x: z.number(), y: z.number() });
export const sizeSchema = z.object({ width: z.number().positive(), height: z.number().positive() });
export const optionsSchema = z.record(z.string(), z.union([z.boolean(), z.string(), z.number()]));
export const tagsSchema = z.array(z.string());
export const DESCRIPTION_LENGTH = 280;
export const descriptionSchema = z.string().max(DESCRIPTION_LENGTH);
export const iconSchema = z.string().min(1);

export type Position = z.infer<typeof positionSchema>;
export type Size = z.infer<typeof sizeSchema>;
export type Side = z.infer<typeof sideSchema>;

const id = idSchema;
// `parent` is the boundary an object sits in, if any. Positions are always absolute, not relative to it.
const placed = { id, position: positionSchema, parent: idSchema.optional() };
const size = sizeSchema.optional();

const component = z.object({
  type: z.literal("component"),
  ...placed,
  kind: z.enum(componentKindNames),
  name: z.string(),
  description: descriptionSchema.optional(),
  options: optionsSchema.default({}),
  structure: databaseStructureSchema.optional(),
  tags: tagsSchema.optional(),
  icon: iconSchema.optional(),
});

const annotated = {
  description: descriptionSchema.optional(),
  tags: tagsSchema.optional(),
  icon: iconSchema.optional(),
};

const text = z.object({ type: z.literal("text"), ...placed, text: z.string() });
const rectangle = z.object({ type: z.literal("rectangle"), ...placed, size, text: z.string(), ...annotated });
const sphere = z.object({ type: z.literal("sphere"), ...placed, size, text: z.string(), ...annotated });

const boundary = z.object({
  type: z.literal("boundary"),
  ...placed,
  size: sizeSchema,
  name: z.string(),
  kind: z.enum(boundaryKindNames).optional(),
  ...annotated,
});

export const objectSchemas = { component, text, rectangle, sphere, boundary };

export const diagramObjectSchema = z.discriminatedUnion("type", [component, text, rectangle, sphere, boundary]);

export const sideSchema = z.enum(["top", "right", "bottom", "left"]);

export const connectionSchema = z.object({
  id,
  from: id,
  to: id,
  fromSide: sideSchema.optional(),
  toSide: sideSchema.optional(),
  label: z.string().default(""),
  direction: z.enum(["forward", "backward", "both", "none"]).default("forward"),
  line: z.enum(["solid", "dashed", "flow"]).default("solid"),
});

export const SCHEMA_VERSION = 1;

export const diagramSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  objects: z.array(diagramObjectSchema),
  connections: z.array(connectionSchema),
});

export type Component = z.infer<typeof component>;
export type Boundary = z.infer<typeof boundary>;
export type DiagramObject = z.infer<typeof diagramObjectSchema>;
export type NewDiagramObject = DiagramObject extends infer T
  ? T extends unknown
    ? Omit<T, "id" | "position">
    : never
  : never;
export type Connection = z.infer<typeof connectionSchema>;
export type Diagram = z.infer<typeof diagramSchema>;

export function emptyDiagram(): Diagram {
  return { schemaVersion: SCHEMA_VERSION, objects: [], connections: [] };
}
