import type { BoundaryKind } from "./boundaryKinds";
import { type ComponentKind, compatibleOptions } from "./componentKinds";
import type { DiagramOperation } from "./operations";
import type { Diagram } from "./schema";

export function applyOperations(diagram: Diagram, operations: DiagramOperation[]): Diagram {
  const next = { ...diagram, objects: [...diagram.objects], connections: [...diagram.connections] };
  for (const operation of operations) applyTo(next, operation);
  return next;
}

// Changes `diagram` in place, copying an object or connection before changing it.
export function applyTo(diagram: Diagram, operation: DiagramOperation): void {
  switch (operation.type) {
    case "object.add":
      diagram.objects.push(operation.object);
      return;

    case "object.update": {
      const index = diagram.objects.findIndex((candidate) => candidate.id === operation.id);
      if (index < 0) return;
      const object = { ...diagram.objects[index] };
      diagram.objects[index] = object;
      const { position, size, name, text, kind, description, options, structure, tags, icon, parent } =
        operation.changes;
      if (position !== undefined) object.position = position;
      if (parent === null) delete object.parent;
      else if (parent !== undefined) object.parent = parent;
      if (object.type === "text") {
        if (text !== undefined) object.text = text;
        return;
      }
      if (description !== undefined) {
        if (description) object.description = description;
        else delete object.description;
      }
      if (tags !== undefined) object.tags = tags;
      if (icon === null) delete object.icon;
      else if (icon !== undefined) object.icon = icon;
      if (object.type === "boundary") {
        if (name !== undefined) object.name = name;
        if (size !== undefined) object.size = size;
        if (kind === null) delete object.kind;
        else if (kind !== undefined) object.kind = kind as BoundaryKind;
        return;
      }
      if (object.type !== "component") {
        if (size !== undefined) object.size = size;
        if (text !== undefined) object.text = text;
        return;
      }
      if (name !== undefined) object.name = name;
      if (kind && kind !== object.kind) {
        object.kind = kind as ComponentKind;
        object.options = compatibleOptions(object.kind, object.options);
        if (kind !== "database") delete object.structure;
      }
      if (options !== undefined) object.options = options;
      if (structure === null) delete object.structure;
      else if (structure !== undefined) object.structure = structure;
      return;
    }

    case "object.remove": {
      const removed = diagram.objects.find((object) => object.id === operation.id);
      diagram.objects = diagram.objects.flatMap((object) => {
        if (object.id === operation.id) return [];
        if (object.parent !== operation.id) return [object];
        const { parent: _, ...kept } = object;
        return [(removed?.parent ? { ...kept, parent: removed.parent } : kept) as typeof object];
      });
      diagram.connections = diagram.connections.filter(
        (connection) => connection.from !== operation.id && connection.to !== operation.id,
      );
      return;
    }

    case "connection.add":
      diagram.connections.push(operation.connection);
      return;

    case "connection.update": {
      const index = diagram.connections.findIndex((candidate) => candidate.id === operation.id);
      if (index >= 0) diagram.connections[index] = { ...diagram.connections[index], ...operation.changes };
      return;
    }

    case "connection.remove":
      diagram.connections = diagram.connections.filter((connection) => connection.id !== operation.id);
  }
}
