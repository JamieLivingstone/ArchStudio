import { z } from "zod";
import { boundaryKindNames } from "./boundaryKinds";
import { componentKindNames } from "./componentKinds";
import { databaseStructureSchema } from "./databaseStructure";
import {
  connectionSchema,
  type DiagramObject,
  descriptionSchema,
  diagramObjectSchema,
  iconSchema,
  idSchema as id,
  optionsSchema,
  type Position,
  positionSchema,
  type Size,
  sizeSchema,
  tagsSchema,
} from "./schema";

export const operationSchemas = {
  objectAdd: z.object({ type: z.literal("object.add"), object: diagramObjectSchema }),
  objectUpdate: z.object({
    type: z.literal("object.update"),
    id,
    /**
     * `options` and `tags` replace the whole set. An empty description, or a
     * null icon, structure, parent or boundary kind, removes it. Changing a
     * component's `kind` drops the options the new kind does not have. `parent`
     * moves the object into a boundary; positions stay absolute.
     */
    changes: z.strictObject({
      position: positionSchema.optional(),
      size: sizeSchema.optional(),
      name: z.string().optional(),
      text: z.string().optional(),
      kind: z
        .union([z.enum(componentKindNames), z.enum(boundaryKindNames)])
        .nullable()
        .optional(),
      parent: id.nullable().optional(),
      description: descriptionSchema.optional(),
      options: optionsSchema.optional(),
      structure: databaseStructureSchema.nullable().optional(),
      tags: tagsSchema.optional(),
      icon: iconSchema.nullable().optional(),
    }),
  }),
  objectRemove: z.object({ type: z.literal("object.remove"), id }),
  connectionAdd: z.object({ type: z.literal("connection.add"), connection: connectionSchema }),
  connectionUpdate: z.object({
    type: z.literal("connection.update"),
    id,
    changes: connectionSchema.pick({ label: true, direction: true, line: true }).partial().strict(),
  }),
  connectionRemove: z.object({ type: z.literal("connection.remove"), id }),
};

export const diagramOperationSchema = z.discriminatedUnion("type", [
  operationSchemas.objectAdd,
  operationSchemas.objectUpdate,
  operationSchemas.objectRemove,
  operationSchemas.connectionAdd,
  operationSchemas.connectionUpdate,
  operationSchemas.connectionRemove,
]);

export type DiagramOperation = z.infer<typeof diagramOperationSchema>;

export function subjectOf(operation: DiagramOperation): string {
  if (operation.type === "object.add") return operation.object.id;
  return operation.type === "connection.add" ? operation.connection.id : operation.id;
}

export function prerequisitesOf(operation: DiagramOperation): string[] {
  if (operation.type === "connection.add") return [operation.connection.from, operation.connection.to];
  const parent = operation.type === "object.add" ? operation.object.parent : undefined;
  const movedInto = operation.type === "object.update" ? operation.changes.parent : undefined;
  return [parent, movedInto].flatMap((id) => (id ? [id] : []));
}

function split(
  operations: DiagramOperation[],
  ids: string[],
  include: (operation: DiagramOperation, chosen: Set<string>, added: Set<string>) => string[],
): [chosen: DiagramOperation[], rest: DiagramOperation[]] {
  const added = new Set(
    operations.flatMap((operation) => (operation.type === "object.add" ? [operation.object.id] : [])),
  );
  const chosen = new Set(ids);
  for (let size = -1; size !== chosen.size; ) {
    size = chosen.size;
    for (const operation of operations) for (const id of include(operation, chosen, added)) chosen.add(id);
  }
  return [
    operations.filter((operation) => chosen.has(subjectOf(operation))),
    operations.filter((operation) => !chosen.has(subjectOf(operation))),
  ];
}

export const withPrerequisites = (operations: DiagramOperation[], ids: string[]) =>
  split(operations, ids, (operation, chosen, added) =>
    chosen.has(subjectOf(operation)) ? prerequisitesOf(operation).filter((id) => added.has(id)) : [],
  );

export const withDependents = (operations: DiagramOperation[], ids: string[]) =>
  split(operations, ids, (operation, chosen, added) =>
    prerequisitesOf(operation).some((id) => chosen.has(id) && added.has(id)) ? [subjectOf(operation)] : [],
  );

export function placementOperations(
  objects: DiagramObject[],
  positions: Map<string, Position>,
  sizes: Map<string, Size>,
) {
  return objects.flatMap((object): DiagramOperation[] => {
    const next = positions.get(object.id);
    const size = object.type === "boundary" ? sizes.get(object.id) : undefined;
    const moved = next && (next.x !== object.position.x || next.y !== object.position.y);
    const resized =
      size && object.type === "boundary" && (object.size.width !== size.width || object.size.height !== size.height);
    if (!moved && !resized) return [];
    return [
      { type: "object.update", id: object.id, changes: { ...(moved && { position: next }), ...(resized && { size }) } },
    ];
  });
}
