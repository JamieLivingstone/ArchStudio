import { applyOperations, applyTo } from "./apply";
import { boundaryKindNames } from "./boundaryKinds";
import {
  type ComponentKind,
  componentKindNames,
  getKindDefinition,
  isApplicable,
  isValidOptionValue,
  type OptionDefinition,
  type OptionValue,
} from "./componentKinds";
import { ancestorsOf } from "./hierarchy";
import { type DiagramOperation, prerequisitesOf, subjectOf } from "./operations";
import { type Connection, type Diagram, type DiagramObject, SCHEMA_VERSION } from "./schema";

export interface Issue {
  code:
    | "duplicate_id"
    | "unknown_object"
    | "unknown_connection"
    | "unknown_option"
    | "invalid_option_value"
    | "field_not_applicable"
    | "connects_to_itself"
    | "not_connectable"
    | "duplicate_connection"
    | "invalid_tag"
    | "option_not_applicable"
    | "structure_mismatch"
    | "invalid_kind"
    | "invalid_parent";
  message: string;
  operation?: number;
}

const issue = (code: Issue["code"], message: string): Issue => ({ code, message });

function idTaken(diagram: Diagram, id: string): boolean {
  return (
    diagram.objects.some((object) => object.id === id) || diagram.connections.some((connection) => connection.id === id)
  );
}

export function expectedValue(option: OptionDefinition): string {
  switch (option.type) {
    case "toggle":
      return "true or false";
    case "choice":
      return `one of: ${option.choices.map((choice) => choice.value).join(", ")}`;
    case "number":
      return `a whole number of ${option.min ?? 0} or more${option.auto ? ', or "Auto"' : ""}`;
    case "text":
      return "short text of up to 80 characters";
    case "duration":
      return `a duration such as "30s", "15m", "12h" or "7d"${option.indefinite ? ', or "Indefinite"' : ""}`;
  }
}

function optionIssues(kind: ComponentKind, options: Record<string, OptionValue>): Issue[] {
  const definitions = getKindDefinition(kind).options;
  return Object.entries(options).flatMap(([key, value]) => {
    const definition = definitions.find((candidate) => candidate.key === key);
    if (!definition) return [issue("unknown_option", `A ${kind} has no option "${key}".`)];
    if (!isValidOptionValue(definition, value)) {
      return [issue("invalid_option_value", `Option "${key}" of a ${kind} must be ${expectedValue(definition)}.`)];
    }
    if (!isApplicable(definition, options)) {
      const { showWhen } = definition;
      return [
        issue(
          "option_not_applicable",
          `Option "${key}" of a ${kind} only applies when "${showWhen?.key}" is one of: ${showWhen?.is.join(", ")}.`,
        ),
      ];
    }
    return [];
  });
}

function structureIssues(object: Extract<DiagramObject, { type: "component" }>): Issue[] {
  const { structure } = object;
  if (!structure) return [];
  if (object.kind !== "database") {
    return [issue("field_not_applicable", `Only a database has a data structure, not a ${object.kind}.`)];
  }
  const model = object.options.model;
  if (structure.model === model) return [];
  return [
    issue(
      "structure_mismatch",
      `The structure describes a ${structure.model} database, but the data model is ${model ? `"${model}"` : "not set"}. ` +
        "Set the matching data model, or remove the structure with structure: null.",
    ),
  ];
}

function contentIssues(object: DiagramObject): Issue[] {
  if (object.type === "text") return [];
  const issues = tagIssues(object.tags ?? []);
  if (object.type === "component")
    issues.push(...optionIssues(object.kind, object.options), ...structureIssues(object));
  return issues;
}

function tagIssues(tags: string[]): Issue[] {
  if (tags.some((tag) => tag.trim() === "")) return [issue("invalid_tag", "A tag cannot be empty.")];
  if (new Set(tags).size !== tags.length) return [issue("invalid_tag", "A tag cannot appear twice.")];
  return [];
}

function parentIssues(diagram: Diagram, object: DiagramObject): Issue[] {
  if (!object.parent) return [];
  const parent = diagram.objects.find((candidate) => candidate.id === object.parent);
  if (!parent) return [issue("unknown_object", `There is no boundary with id "${object.parent}" to put it in.`)];
  if (parent.type !== "boundary") {
    return [issue("invalid_parent", `Only a boundary can contain other objects, not a ${parent.type}.`)];
  }
  if (parent.id === object.id || ancestorsOf(diagram, parent).some((ancestor) => ancestor.id === object.id)) {
    return [issue("invalid_parent", `"${object.id}" cannot be put inside itself.`)];
  }
  return [];
}

function objectIssues(diagram: Diagram, object: DiagramObject): Issue[] {
  const issues: Issue[] = [];
  if (idTaken(diagram, object.id)) {
    issues.push(issue("duplicate_id", `Something with id "${object.id}" already exists.`));
  }
  if (object.type === "text" && ("description" in object || "tags" in object || "icon" in object)) {
    issues.push(issue("field_not_applicable", "Text has only its words."));
  }
  issues.push(...contentIssues(object));
  return issues;
}

function connectionIssues(diagram: Diagram, connection: Connection): Issue[] {
  const issues: Issue[] = [];
  if (idTaken(diagram, connection.id)) {
    issues.push(issue("duplicate_id", `Something with id "${connection.id}" already exists.`));
  }
  for (const end of [connection.from, connection.to]) {
    const object = diagram.objects.find((candidate) => candidate.id === end);
    if (!object) {
      issues.push(issue("unknown_object", `There is no object with id "${end}" to connect.`));
    } else if (object.type === "text") {
      issues.push(issue("not_connectable", `Text ("${end}") cannot be connected to anything.`));
    }
  }
  if (connection.from === connection.to) {
    issues.push(issue("connects_to_itself", "An object cannot be connected to itself."));
  }
  const duplicate = diagram.connections.some(
    (existing) => existing.from === connection.from && existing.to === connection.to,
  );
  if (duplicate) {
    issues.push(issue("duplicate_connection", `"${connection.from}" is already connected to "${connection.to}".`));
  }
  return issues;
}

export function validateOperation(diagram: Diagram, operation: DiagramOperation): Issue[] {
  switch (operation.type) {
    case "object.add":
      return [...objectIssues(diagram, operation.object), ...parentIssues(diagram, operation.object)];

    case "object.update": {
      const object = diagram.objects.find((candidate) => candidate.id === operation.id);
      if (!object) return [issue("unknown_object", `There is no object with id "${operation.id}".`)];
      const given = (fields: (keyof typeof operation.changes)[]) =>
        fields.filter((field) => operation.changes[field] !== undefined);
      const misplaced = {
        component: given(["text", "size"]),
        boundary: given(["text", "options", "structure"]),
        text: given(["name", "kind", "options", "structure", "size", "description", "tags", "icon"]),
        rectangle: given(["name", "kind", "options", "structure"]),
        sphere: given(["name", "kind", "options", "structure"]),
      }[object.type];
      if (misplaced.length > 0) {
        return [issue("field_not_applicable", `A ${object.type} has no ${misplaced.join(", ")}.`)];
      }
      const { kind } = operation.changes;
      if (kind !== undefined) {
        const kinds: readonly (string | null)[] =
          object.type === "component" ? componentKindNames : [...boundaryKindNames, null];
        if (!kinds.includes(kind)) {
          return [
            issue("invalid_kind", `A ${object.type}'s kind must be one of: ${kinds.filter(Boolean).join(", ")}.`),
          ];
        }
      }
      const [updated] = applyOperations({ ...diagram, objects: [object], connections: [] }, [operation]).objects;
      const next = { ...diagram, objects: diagram.objects.map((other) => (other === object ? updated : other)) };
      return [...contentIssues(updated), ...parentIssues(next, updated)];
    }

    case "object.remove":
      return diagram.objects.some((object) => object.id === operation.id)
        ? []
        : [issue("unknown_object", `There is no object with id "${operation.id}".`)];

    case "connection.add":
      return connectionIssues(diagram, operation.connection);

    case "connection.update":
    case "connection.remove":
      return diagram.connections.some((connection) => connection.id === operation.id)
        ? []
        : [issue("unknown_connection", `There is no connection with id "${operation.id}".`)];
  }
}

export function validateOperations(diagram: Diagram, operations: DiagramOperation[]): Issue[] {
  const current = { ...diagram, objects: [...diagram.objects], connections: [...diagram.connections] };
  const issues: Issue[] = [];
  const failed = new Set<string>();
  for (const [index, operation] of operations.entries()) {
    const subject = subjectOf(operation);
    if (failed.has(subject) || prerequisitesOf(operation).some((id) => failed.has(id))) {
      failed.add(subject);
      continue;
    }
    const found = validateOperation(current, operation);
    if (found.length > 0) {
      issues.push(...found.map((each) => ({ ...each, operation: index })));
      failed.add(subject);
    } else {
      applyTo(current, operation);
    }
  }
  return issues;
}

export function validateDiagram(diagram: Diagram): Issue[] {
  const rebuilt: Diagram = { schemaVersion: SCHEMA_VERSION, objects: [], connections: [] };
  const issues: Issue[] = [];
  for (const object of diagram.objects) {
    issues.push(...objectIssues(rebuilt, object));
    rebuilt.objects.push(object);
  }
  for (const object of diagram.objects) issues.push(...parentIssues(diagram, object));
  for (const connection of diagram.connections) {
    issues.push(...connectionIssues(rebuilt, connection));
    rebuilt.connections.push(connection);
  }
  return issues;
}
