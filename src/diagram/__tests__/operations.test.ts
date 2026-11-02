import { expect, test } from "vitest";
import {
  boundary,
  codes,
  component,
  connection,
  connectionAdd,
  connectionRemove,
  diagramOf,
  objectAdd,
  objectRemove,
  objectUpdate,
  shape,
} from "../../test/fixtures";
import { applyOperations } from "../apply";
import { type DiagramOperation, subjectOf, withDependents, withPrerequisites } from "../operations";
import type { Connection, Diagram, DiagramObject } from "../schema";
import { validateDiagram, validateOperation, validateOperations } from "../validate";

const web = component("web", "Web", "webClient");
const lb = component("lb", "LB", "loadBalancer", { position: { x: 200, y: 0 }, options: { layer: "Layer 4" } });
const box = shape("box", "Zone", "rectangle", { position: { x: 0, y: 200 } });
const note = shape("note", "Hi", "text", { position: { x: 0, y: 300 } });
const app = component("app", "App", "mobileApp");
const webToLb = connection("web-lb", "web", "lb", "HTTPS");

const start = () => diagramOf([web, lb, box, note], [webToLb]);

function run(diagram: Diagram, ...operations: DiagramOperation[]): Diagram {
  expect(validateOperations(diagram, operations)).toEqual([]);
  const next = applyOperations(diagram, operations);
  expect(validateDiagram(next)).toEqual([]);
  return next;
}

const check = (operation: DiagramOperation) => codes(validateOperation(start(), operation));

test("adds an object", () => {
  const next = run(start(), objectAdd(app));
  expect(next.objects[next.objects.length - 1]).toEqual(app);
});

test("will not add an object whose id is taken, or whose options do not fit its kind", () => {
  expect(check(objectAdd({ ...web }))).toEqual(["duplicate_id"]);
  expect(check(objectAdd({ ...web, id: "web-lb" }))).toEqual(["duplicate_id"]);
  expect(check(objectAdd({ ...lb, id: "lb2", options: { cdn: true } }))).toEqual(["unknown_option"]);
  expect(check(objectAdd({ ...lb, id: "lb2", options: { layer: "Layer 9" } }))).toEqual(["invalid_option_value"]);
  expect(check(objectAdd({ ...lb, id: "lb2", options: { sticky: "yes" } }))).toEqual(["invalid_option_value"]);
});

test("renames a component and replaces its options", () => {
  const next = run(start(), objectUpdate("lb", { name: "Edge LB", options: { sticky: true } }));
  expect(next.objects[1]).toMatchObject({ name: "Edge LB", options: { sticky: true } });
});

test("a change that leaves a field out leaves it alone", () => {
  const next = run(start(), objectUpdate("lb", { name: "Edge LB" }));
  expect(next.objects[1]).toMatchObject({ options: { layer: "Layer 4" } });
});

test("changes the text of a shape", () => {
  const next = run(start(), objectUpdate("box", { text: "Zone A" }));
  expect(next.objects[2]).toMatchObject({ text: "Zone A" });
});

test("will not give a component text, or a shape a name or options", () => {
  expect(check(objectUpdate("lb", { text: "x" }))).toEqual(["field_not_applicable"]);
  expect(check(objectUpdate("box", { name: "x" }))).toEqual(["field_not_applicable"]);
  expect(check(objectUpdate("note", { options: {} }))).toEqual(["field_not_applicable"]);
  expect(check(objectUpdate("lb", { options: { cdn: true } }))).toEqual(["unknown_option"]);
});

test("moves an object, alone or along with other changes", () => {
  const moved = run(start(), objectUpdate("note", { position: { x: 50, y: 60 } }));
  expect(moved.objects[3]).toEqual({ ...note, position: { x: 50, y: 60 } });

  const both = run(start(), objectUpdate("lb", { position: { x: 1, y: 2 }, name: "Edge LB" }));
  expect(both.objects[1]).toMatchObject({ position: { x: 1, y: 2 }, name: "Edge LB" });
});

test("removing an object removes its connections too", () => {
  const next = run(start(), objectRemove("lb"));
  expect(next.objects.map((object) => object.id)).toEqual(["web", "box", "note"]);
  expect(next.connections).toEqual([]);
});

test("will not update or remove an object that is not there", () => {
  for (const operation of [objectUpdate("gone", {}), objectRemove("gone")] satisfies DiagramOperation[]) {
    expect(check(operation)).toEqual(["unknown_object"]);
  }
});

test("connects two objects", () => {
  const lbToBox: Connection = { ...webToLb, id: "lb-box", from: "lb", to: "box", label: "" };
  const next = run(start(), connectionAdd(lbToBox));
  expect(next.connections).toEqual([webToLb, lbToBox]);
});

test("the same two objects can be connected in the other direction", () => {
  run(start(), connectionAdd({ ...webToLb, id: "back", from: "lb", to: "web" }));
});

test("will not make a connection that breaks the rules", () => {
  const add = (connection: Partial<Connection>) => check(connectionAdd({ ...webToLb, id: "new", ...connection }));
  expect(add({ id: "web-lb", from: "lb", to: "box" })).toEqual(["duplicate_id"]);
  expect(add({ id: "box", from: "lb", to: "box" })).toEqual(["duplicate_id"]);
  expect(add({ to: "gone" })).toEqual(["unknown_object"]);
  expect(add({ from: "lb", to: "lb" })).toEqual(["connects_to_itself"]);
  expect(add({ to: "note" })).toEqual(["not_connectable"]);
  expect(add({})).toEqual(["duplicate_connection"]);
});

test("updates a connection's label, direction and line", () => {
  const next = run(start(), {
    type: "connection.update",
    id: "web-lb",
    changes: { label: "gRPC", direction: "both", line: "dashed" },
  });
  expect(next.connections[0]).toEqual({
    ...webToLb,
    label: "gRPC",
    direction: "both",
    line: "dashed",
  });
});

test("removes a connection and leaves its objects", () => {
  const next = run(start(), connectionRemove("web-lb"));
  expect(next.connections).toEqual([]);
  expect(next.objects).toHaveLength(4);
});

test("will not update or remove a connection that is not there", () => {
  expect(check({ type: "connection.update", id: "gone", changes: {} })).toEqual(["unknown_connection"]);
  expect(check(connectionRemove("gone"))).toEqual(["unknown_connection"]);
});

test("a batch can build on its own earlier operations", () => {
  const next = run(
    start(),
    objectAdd(app),
    connectionAdd({ ...webToLb, id: "app-lb", from: "app" }),
    objectRemove("web"),
  );
  expect(next.objects.map((object) => object.id)).toEqual(["lb", "box", "note", "app"]);
  expect(next.connections.map((connection) => connection.id)).toEqual(["app-lb"]);
});

test("a batch reports every operation at fault, and which each one was", () => {
  const diagram = start();
  const issues = validateOperations(diagram, [
    objectUpdate("web", { position: { x: 1, y: 1 } }),
    objectRemove("gone"),
    objectRemove("also-gone"),
  ]);
  expect(issues).toEqual([
    expect.objectContaining({ code: "unknown_object", operation: 1 }),
    expect.objectContaining({ code: "unknown_object", operation: 2 }),
  ]);
  expect(diagram).toEqual(start());
});

test("what depends on an operation at fault is not reported as a second fault", () => {
  const issues = validateOperations(start(), [
    objectAdd({ ...lb, id: "cache", options: { nonsense: true } }),
    connectionAdd({ ...webToLb, id: "c9", from: "web", to: "cache" }),
    objectUpdate("cache", { name: "Cache" }),
  ]);
  expect(issues).toEqual([expect.objectContaining({ code: "unknown_option", operation: 0 })]);
});

test("a whole diagram is checked for what the schema cannot express", () => {
  expect(validateDiagram(start())).toEqual([]);
  const broken = diagramOf(
    [web, { ...web }, { ...lb, options: { cdn: true } }],
    [webToLb, { ...webToLb, id: "dangling", to: "gone" }],
  );
  expect(codes(validateDiagram(broken))).toEqual(["duplicate_id", "unknown_option", "unknown_object"]);
});

test("every issue explains itself in words", () => {
  const [issue] = validateOperation(start(), objectRemove("gone"));
  expect(issue.message).toBe('There is no object with id "gone".');
});

test("applying operations leaves the original diagram untouched", () => {
  const diagram = start();
  const next = applyOperations(diagram, [objectRemove("lb")]);
  expect(diagram).toEqual(start());
  expect(next).not.toBe(diagram);
});

test("an update copies the object it changes and shares what it holds", () => {
  const diagram = start();
  const tagged = run(diagram, objectUpdate("lb", { tags: ["edge"] }));
  const moved = run(tagged, objectUpdate("lb", { position: { x: 5, y: 5 } }));
  expect(tagged.objects[1]).toMatchObject({ position: diagram.objects[1].position });
  expect(moved.objects[1]).not.toBe(tagged.objects[1]);
  expect((moved.objects[1] as { tags?: string[] }).tags).toBe((tagged.objects[1] as { tags?: string[] }).tags);
});

test("sets and replaces a component's tags", () => {
  const tagged = run(start(), objectUpdate("lb", { tags: ["edge", "EU only"] }));
  expect(tagged.objects[1]).toMatchObject({ tags: ["edge", "EU only"] });
  const cleared = run(tagged, objectUpdate("lb", { tags: [] }));
  expect(cleared.objects[1]).toMatchObject({ tags: [] });
});

test("will not accept empty or repeated tags, or tags on text", () => {
  expect(check(objectUpdate("lb", { tags: ["edge", " "] }))).toEqual(["invalid_tag"]);
  expect(check(objectUpdate("lb", { tags: ["edge", "edge"] }))).toEqual(["invalid_tag"]);
  expect(check(objectAdd({ ...lb, id: "lb2", tags: [""] }))).toEqual(["invalid_tag"]);
  expect(check(objectUpdate("box", { tags: ["zone", "zone"] }))).toEqual(["invalid_tag"]);
  expect(check(objectUpdate("note", { tags: ["zone"] }))).toEqual(["field_not_applicable"]);
});

test("resizes a shape, but not text or a component", () => {
  const resized = run(start(), objectUpdate("box", { size: { width: 300, height: 120 } }));
  expect(resized.objects[2]).toMatchObject({ size: { width: 300, height: 120 } });
  expect(check(objectUpdate("note", { size: { width: 10, height: 10 } }))).toEqual(["field_not_applicable"]);
  expect(check(objectUpdate("lb", { size: { width: 10, height: 10 } }))).toEqual(["field_not_applicable"]);
});

test("components and shapes take a description, tags and an icon, and give them back", () => {
  const details = { description: "Handles payment authorisation.", tags: ["PCI", "payments"], icon: "CreditCard" };
  const next = run(start(), objectUpdate("lb", details), objectUpdate("box", details));
  expect(next.objects[1]).toMatchObject(details);
  expect(next.objects[2]).toMatchObject(details);
  expect(JSON.parse(JSON.stringify(next))).toEqual(next);
});

test("an empty description or a null icon removes it", () => {
  const described = run(start(), objectUpdate("lb", { description: "Spreads traffic.", icon: "Zap" }));
  const cleared = run(described, objectUpdate("lb", { description: "", icon: null }));
  expect(cleared.objects[1]).not.toHaveProperty("description");
  expect(cleared.objects[1]).not.toHaveProperty("icon");
});

test("text has only its words", () => {
  for (const changes of [{ description: "x" }, { icon: "Zap" }, { kind: "cache" as const }]) {
    expect(check({ type: "object.update", id: "note", changes })).toEqual(["field_not_applicable"]);
  }
  expect(check(objectUpdate("box", { kind: "cache" }))).toEqual(["field_not_applicable"]);
});

test("a description is kept short", () => {
  expect(validateDiagram({ ...start(), objects: [{ ...lb, description: "x".repeat(281) }] })).not.toEqual([]);
});

test("changing a component's kind keeps only the details the new kind has", () => {
  const service: DiagramObject = {
    ...lb,
    id: "svc",
    kind: "service",
    options: { state: "Stateless", instances: 3, scaling: "Horizontal" },
    tags: ["Node.js"],
    description: "Orders API",
  };
  const next = run(diagramOf([service]), objectUpdate("svc", { kind: "worker" }));
  expect(next.objects[0]).toMatchObject({
    kind: "worker",
    options: { instances: 3 },
    tags: ["Node.js"],
    description: "Orders API",
  });
});

test("an unset option is absent, not a stand-in default, and an explicit Off is kept", () => {
  const next = run(start(), objectUpdate("lb", { options: { sticky: false } }));
  expect(next.objects[1]).toMatchObject({ options: { sticky: false } });
  expect((next.objects[1] as { options: object }).options).not.toHaveProperty("layer");
});

const proposed: DiagramOperation[] = [
  objectAdd(boundary("zone")),
  objectAdd({ ...lb, id: "cache", parent: "zone" }),
  connectionAdd({ ...webToLb, id: "c9", from: "web", to: "cache" }),
  objectUpdate("web", { name: "Site" }),
  connectionRemove("c1"),
];
const subjects = (operations: DiagramOperation[]) => operations.map(subjectOf);

test("part of a batch brings the additions it cannot be applied without", () => {
  const [chosen, rest] = withPrerequisites(proposed, ["c9"]);
  expect(subjects(chosen)).toEqual(["zone", "cache", "c9"]);
  expect(subjects(rest)).toEqual(["web", "c1"]);
  expect(subjects(withPrerequisites(proposed, ["web"])[0])).toEqual(["web"]);
});

test("leaving part of a batch out takes what cannot be applied without it", () => {
  const [dropped, rest] = withDependents(proposed, ["zone"]);
  expect(subjects(dropped)).toEqual(["zone", "cache", "c9"]);
  expect(subjects(rest)).toEqual(["web", "c1"]);
  expect(subjects(withDependents(proposed, ["web"])[0])).toEqual(["web"]);
});
