import { expect, test } from "vitest";
import { applyOperations } from "../../diagram/apply";
import { validateOperations } from "../../diagram/validate";
import { component, diagramOf } from "../../test/fixtures";
import { type EditOperation, editOperationSchema, toDiagramOperations } from "../editOperations";

const diagram = diagramOf([
  component("db", "Orders", "database", {
    position: { x: 40, y: 40 },
    options: { model: "Relational", replication: "Primary-replica", replicaCount: 2, consistency: "Strong" },
  }),
]);

const read = (edits: unknown[]) => {
  const parsed = edits.map((edit) => editOperationSchema.parse(edit));
  const operations = toDiagramOperations(diagram, parsed);
  expect(validateOperations(diagram, operations)).toEqual([]);
  return { operations, after: applyOperations(diagram, operations) };
};

test("something can be added with no position, and a boundary with no size", () => {
  const { after } = read([
    { type: "object.add", object: { type: "boundary", id: "zone", name: "Backend" } },
    { type: "object.add", object: { type: "component", id: "api", kind: "service", name: "API", parent: "zone" } },
    { type: "connection.add", connection: { id: "c1", from: "api", to: "db" } },
  ]);
  expect(after.objects.slice(1)).toEqual([
    { type: "boundary", id: "zone", name: "Backend", position: { x: 0, y: 0 }, size: { width: 320, height: 200 } },
    {
      type: "component",
      id: "api",
      kind: "service",
      name: "API",
      parent: "zone",
      position: { x: 0, y: 0 },
      options: {},
    },
  ]);
  expect(after.connections).toEqual([
    { id: "c1", from: "api", to: "db", label: "", direction: "forward", line: "solid" },
  ]);
});

test("a position that is given is kept", () => {
  const { operations } = read([
    { type: "object.add", object: { type: "text", id: "note", text: "Hi", position: { x: 5, y: 6 } } },
    { type: "object.update", id: "db", changes: { position: { x: 9, y: 9 } } },
  ]);
  expect(operations[0]).toMatchObject({ object: { position: { x: 5, y: 6 } } });
  expect(operations[1]).toMatchObject({ changes: { position: { x: 9, y: 9 } } });
});

test("an icon is not a model's to set", () => {
  const withIcon = { type: "component", id: "api", kind: "service", name: "API", icon: "Server" };
  expect(editOperationSchema.parse({ type: "object.add", object: withIcon })).not.toHaveProperty("object.icon");
  const update = { type: "object.update", id: "db", changes: { icon: "Server" } };
  expect(editOperationSchema.safeParse(update).success).toBe(false);
});

test("the sides a line meets are not a model's to set", () => {
  const connection = { id: "line", from: "api", to: "db", fromSide: "bottom", toSide: "top" };
  const parsed = editOperationSchema.parse({ type: "connection.add", connection });
  expect(parsed).not.toHaveProperty("connection.fromSide");
  expect(parsed).not.toHaveProperty("connection.toSide");
});

const optionsAfter = (changes: Extract<EditOperation, { type: "object.update" }>["changes"]) =>
  (read([{ type: "object.update", id: "db", changes }]).after.objects[0] as { options: unknown }).options;

test("an update changes only the options it names, and null clears one", () => {
  expect(optionsAfter({ options: { consistency: "Eventual", failover: "Automatic" } })).toEqual({
    model: "Relational",
    replication: "Primary-replica",
    replicaCount: 2,
    consistency: "Eventual",
    failover: "Automatic",
  });
  expect(optionsAfter({ options: { consistency: null } })).toEqual({
    model: "Relational",
    replication: "Primary-replica",
    replicaCount: 2,
  });
});

test("an option left behind by a change it did not name is dropped with it", () => {
  expect(optionsAfter({ options: { replication: "None" } })).toEqual({
    model: "Relational",
    replication: "None",
    consistency: "Strong",
  });
});

test("an option it did name that does not apply is kept, for validation to answer", () => {
  const operations = toDiagramOperations(diagram, [
    { type: "object.update", id: "db", changes: { options: { replication: "None", replicaCount: 3 } } },
  ]);
  expect(validateOperations(diagram, operations)).toEqual([
    expect.objectContaining({ code: "option_not_applicable", operation: 0 }),
  ]);
});

test("options are merged with what earlier operations in the batch left, and follow a change of kind", () => {
  const { after } = read([
    {
      type: "object.add",
      object: { type: "component", id: "api", kind: "service", name: "API", options: { instances: 2 } },
    },
    { type: "object.update", id: "api", changes: { options: { state: "Stateless" } } },
    { type: "object.update", id: "api", changes: { kind: "worker", options: { concurrency: 4 } } },
  ]);
  expect(after.objects[1]).toMatchObject({ kind: "worker", options: { instances: 2, concurrency: 4 } });
});

test("an operation that makes no sense is left for validation to report, not tripped over", () => {
  const edits = [
    editOperationSchema.parse({ type: "object.update", id: "db", changes: { kind: "team" } }),
    editOperationSchema.parse({ type: "object.update", id: "db", changes: { options: { consistency: "Eventual" } } }),
  ];
  const operations = toDiagramOperations(diagram, edits);
  expect(validateOperations(diagram, operations)).toEqual([
    expect.objectContaining({ code: "invalid_kind", operation: 0 }),
  ]);
});
