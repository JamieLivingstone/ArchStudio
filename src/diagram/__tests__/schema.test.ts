import { expect, test } from "vitest";
import { diagramOperationSchema } from "../operations";
import { diagramSchema, emptyDiagram } from "../schema";

const diagram = {
  schemaVersion: 1,
  objects: [
    { type: "component", id: "lb", position: { x: 0, y: 0 }, kind: "loadBalancer", name: "LB" },
    { type: "text", id: "note", position: { x: 10, y: 10 }, text: "Public zone" },
  ],
  connections: [{ id: "c1", from: "lb", to: "note" }],
};

test("an empty diagram is valid", () => {
  expect(diagramSchema.parse(emptyDiagram())).toEqual(emptyDiagram());
});

test("parsing fills in what a minimal diagram leaves out", () => {
  const parsed = diagramSchema.parse(diagram);
  expect(parsed.objects[0]).toMatchObject({ options: {} });
  expect(parsed.connections[0]).toEqual({
    id: "c1",
    from: "lb",
    to: "note",
    label: "",
    direction: "forward",
    line: "solid",
  });
});

test("survives being saved as JSON and read back", () => {
  const parsed = diagramSchema.parse(diagram);
  expect(diagramSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
});

test.each([
  ["an unknown schema version", { ...diagram, schemaVersion: 2 }],
  ["an unknown object type", { ...diagram, objects: [{ type: "cloud", id: "x" }] }],
  ["an unknown component kind", { ...diagram, objects: [{ ...diagram.objects[0], kind: "postgresql" }] }],
  ["an object without a position", { ...diagram, objects: [{ type: "text", id: "t", text: "" }] }],
  ["an empty id", { ...diagram, objects: [{ ...diagram.objects[1], id: "" }] }],
  ["an unknown line style", { ...diagram, connections: [{ ...diagram.connections[0], line: "x" }] }],
])("rejects %s", (_, invalid) => {
  expect(diagramSchema.safeParse(invalid).success).toBe(false);
});

test("an operation is recognised by its type", () => {
  const parsed = diagramOperationSchema.parse({
    type: "object.update",
    id: "lb",
    changes: { position: { x: 5, y: 6 } },
  });
  expect(parsed.type).toBe("object.update");
});

test.each([
  ["an unknown type", { type: "object.duplicate", id: "lb" }],
  ["a missing field", { type: "object.update", id: "lb" }],
  ["a change to a field that does not exist", { type: "object.update", id: "lb", changes: { colour: "red" } }],
  ["a change to a connection's ends", { type: "connection.update", id: "c1", changes: { from: "x" } }],
])("rejects an operation with %s", (_, invalid) => {
  expect(diagramOperationSchema.safeParse(invalid).success).toBe(false);
});
