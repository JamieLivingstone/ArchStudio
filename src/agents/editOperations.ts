import { z } from "zod";
import { applyOperations } from "../diagram/apply";
import {
  type ComponentKind,
  compatibleOptions,
  componentKindNames,
  getKindDefinition,
  isApplicable,
  type OptionValue,
} from "../diagram/componentKinds";
import { type DiagramOperation, operationSchemas } from "../diagram/operations";
import { type Diagram, type DiagramObject, objectSchemas, optionsSchema } from "../diagram/schema";
import { validateOperation } from "../diagram/validate";

const { component, text, rectangle, sphere, boundary } = objectSchemas;
const placed = { position: true } as const;
const { objectAdd, objectUpdate, objectRemove, connectionAdd, connectionUpdate, connectionRemove } = operationSchemas;

export const editOperationSchema = z.discriminatedUnion("type", [
  objectAdd.extend({
    object: z.discriminatedUnion("type", [
      component.omit({ icon: true }).partial(placed),
      text.partial(placed),
      rectangle.omit({ icon: true }).partial(placed),
      sphere.omit({ icon: true }).partial(placed),
      boundary.omit({ icon: true }).partial({ position: true, size: true }),
    ]),
  }),
  objectUpdate.extend({
    changes: objectUpdate.shape.changes
      .omit({ icon: true })
      .extend({ options: z.record(z.string(), optionsSchema.valueType.nullable()).optional() }),
  }),
  objectRemove,
  connectionAdd.extend({ connection: connectionAdd.shape.connection.omit({ fromSide: true, toSide: true }) }),
  connectionUpdate,
  connectionRemove,
]);

export type EditOperation = z.infer<typeof editOperationSchema>;

const UNPLACED = { x: 0, y: 0 };
const BOUNDARY_SIZE = { width: 320, height: 200 };

function mergedOptions(
  object: DiagramObject | undefined,
  kind: unknown,
  named: Record<string, OptionValue | null>,
): Record<string, OptionValue> {
  const set = Object.fromEntries(Object.entries(named).filter(([, value]) => value !== null)) as Record<
    string,
    OptionValue
  >;
  if (object?.type !== "component") return set;
  const next = componentKindNames.includes(kind as ComponentKind) ? (kind as ComponentKind) : object.kind;
  const merged = { ...(next === object.kind ? object.options : compatibleOptions(next, object.options)), ...set };
  for (const key of Object.keys(named)) if (named[key] === null) delete merged[key];
  for (const option of getKindDefinition(next).options) {
    if (!(option.key in named) && !isApplicable(option, merged)) delete merged[option.key];
  }
  return merged;
}

export function toDiagramOperations(diagram: Diagram, edits: EditOperation[]): DiagramOperation[] {
  let current = diagram;
  return edits.map((edit) => {
    let operation: DiagramOperation;
    if (edit.type === "object.add") {
      const size = edit.object.type === "boundary" ? { size: edit.object.size ?? BOUNDARY_SIZE } : {};
      const object = { ...edit.object, position: edit.object.position ?? UNPLACED, ...size } as DiagramObject;
      operation = { type: "object.add", object };
    } else if (edit.type === "object.update" && edit.changes.options) {
      const object = current.objects.find((candidate) => candidate.id === edit.id);
      const options = mergedOptions(object, edit.changes.kind, edit.changes.options);
      operation = { ...edit, changes: { ...edit.changes, options } };
    } else {
      operation = edit as DiagramOperation;
    }
    if (validateOperation(current, operation).length === 0) current = applyOperations(current, [operation]);
    return operation;
  });
}
