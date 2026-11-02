import { expect, test } from "vitest";
import {
  boundary,
  component,
  connection,
  connectionAdd,
  diagramOf,
  objectAdd,
  objectRemove,
  objectUpdate,
  shape,
} from "../../test/fixtures";
import { applyOperations } from "../apply";
import { type DiagramChange, diffDiagrams } from "../diff";
import type { DiagramOperation } from "../operations";
import type { Diagram } from "../schema";

const diagram = diagramOf(
  [
    boundary("backend", { name: "Backend", kind: "service" }),
    component("web", "Web", "webClient"),
    component("api", "API", "service", { options: { instances: 2 }, parent: "backend" }),
    component("db", "Orders", "database", {
      tags: ["PostgreSQL"],
      options: { model: "Relational" },
      structure: { model: "Relational", tables: [{ name: "orders", columns: [{ name: "id", primaryKey: true }] }] },
      parent: "backend",
    }),
    shape("note", "Draft", "text"),
  ],
  [connection("c1", "web", "api"), connection("c2", "api", "db", "SQL")],
);

const diff = (operations: DiagramOperation[]) => diffDiagrams(diagram, applyOperations(diagram, operations));
const only = (changes: DiagramChange[]) => {
  expect(changes).toHaveLength(1);
  return changes[0];
};

test("identical diagrams have no differences", () => {
  expect(diffDiagrams(diagram, structuredClone(diagram))).toEqual([]);
});

test("something added is named, with what was set on it", () => {
  const changes = diff([
    objectAdd(component("cache", "Redis", "cache", { tags: ["Redis"], parent: "backend" })),
    connectionAdd(connection("c3", "api", "cache")),
  ]);
  expect(changes).toEqual([
    {
      target: "object",
      id: "cache",
      change: "added",
      title: "Redis",
      what: "Cache",
      fields: [
        { label: "Inside", after: "Backend" },
        { label: "Tags", after: "Redis" },
      ],
    },
    { target: "connection", id: "c3", change: "added", title: "API → Redis", what: "connection", fields: [] },
  ]);
});

test("an added connection lists only what is not ordinary", () => {
  const [added] = diff([connectionAdd(connection("c3", "web", "db", "reads", { direction: "both" }))]);
  expect(added.fields).toEqual([
    { label: "Label", after: "reads" },
    { label: "Direction", after: "both" },
  ]);
});

test("a changed component lists each thing that changed, before and after", () => {
  const change = only(
    diff([
      objectUpdate("api", {
        name: "Orders API",
        description: "Takes orders.",
        tags: ["Go"],
        options: { state: "Stateless", instances: 3 },
      }),
    ]),
  );
  expect(change).toMatchObject({ id: "api", change: "changed", title: "Orders API", what: "Service" });
  expect(change.fields).toEqual([
    { label: "Name", before: "API", after: "Orders API" },
    { label: "Description", after: "Takes orders." },
    { label: "Tags", after: "Go" },
    { label: "State", after: "Stateless" },
    { label: "Instances", before: "2", after: "3" },
  ]);
});

test("a detail that is cleared shows what it was", () => {
  const change = only(diff([objectUpdate("db", { tags: [], structure: null })]));
  expect(change.fields).toEqual([
    { label: "Tags", before: "PostgreSQL" },
    { label: "Structure", before: "table orders(id PK)" },
  ]);
});

test("a change of kind shows, along with the details it drops", () => {
  const change = only(diff([objectUpdate("api", { kind: "worker" })]));
  expect(change.what).toBe("Worker");
  expect(change.fields[0]).toEqual({ label: "Kind", before: "Service", after: "Worker" });
});

test("going into or out of a boundary names the boundary", () => {
  const changes = diff([objectUpdate("web", { parent: "backend" }), objectUpdate("api", { parent: null })]);
  expect(changes.map(({ id, fields }) => [id, fields])).toEqual([
    ["web", [{ label: "Inside", after: "Backend" }]],
    ["api", [{ label: "Inside", before: "Backend" }]],
  ]);
});

test("a new position or size alone is a move", () => {
  const changes = diff([
    objectUpdate("web", { position: { x: 50, y: 0 } }),
    objectUpdate("backend", { size: { width: 500, height: 300 } }),
    objectUpdate("api", { position: { x: 9, y: 9 }, name: "Gateway" }),
  ]);
  expect(changes.map(({ id, change }) => [id, change])).toEqual([
    ["backend", "moved"],
    ["web", "moved"],
    ["api", "changed"],
  ]);
  expect(changes[2].fields).toEqual([{ label: "Name", before: "API", after: "Gateway" }]);
});

test("removing something shows the connections that go with it", () => {
  const changes = diff([objectRemove("db")]);
  expect(changes.map(({ target, id, change, title }) => [target, id, change, title])).toEqual([
    ["object", "db", "removed", "Orders"],
    ["connection", "c2", "removed", "API → Orders"],
  ]);
  expect(changes[1].fields).toEqual([{ label: "Label", before: "SQL" }]);
});

test("removing a boundary shows its contents leaving it", () => {
  const changes = diff([objectRemove("backend")]);
  expect(changes.map(({ id, change }) => [id, change])).toEqual([
    ["api", "changed"],
    ["db", "changed"],
    ["backend", "removed"],
  ]);
  expect(changes[0].fields).toEqual([{ label: "Inside", before: "Backend" }]);
});

test("a changed connection lists what changed, and renaming an end does not change it", () => {
  const changes = diff([
    { type: "connection.update", id: "c1", changes: { label: "HTTPS", line: "dashed" } },
    objectUpdate("api", { name: "Gateway" }),
  ]);
  expect(changes.map(({ id }) => id)).toEqual(["api", "c1"]);
  expect(changes[1]).toMatchObject({ change: "changed", title: "Web → Gateway" });
  expect(changes[1].fields).toEqual([
    { label: "Label", after: "HTTPS" },
    { label: "Line", before: "solid", after: "dashed" },
  ]);
});

test("operations that cancel out or change nothing do not show", () => {
  expect(
    diff([objectUpdate("api", { name: "API" }), objectAdd(shape("temp", "Temp", "text")), objectRemove("temp")]),
  ).toEqual([]);
});

test("a connection with the same id between different things is a different connection", () => {
  const after = structuredClone(diagram);
  after.connections[0].to = "db";
  expect(diffDiagrams(diagram, after).map(({ change, title }) => [change, title])).toEqual([
    ["added", "Web → Orders"],
    ["removed", "Web → API"],
  ]);
});

test("a note is titled by its text, and something unnamed is Untitled", () => {
  const changes = diff([objectUpdate("note", { text: "Final" }), objectAdd(shape("box", " "))]);
  expect(changes[0]).toMatchObject({
    title: "Final",
    what: "note",
    fields: [{ label: "Text", before: "Draft", after: "Final" }],
  });
  expect(changes[1]).toMatchObject({ title: "Untitled", what: "rectangle", fields: [] });
});

test("moving between two boundaries of the same name is still a change", () => {
  const twins: Diagram = diagramOf([
    boundary("one", { name: "Service" }),
    boundary("two", { name: "Service" }),
    component("api", "API", "service", { parent: "one" }),
  ]);
  const moved = applyOperations(twins, [objectUpdate("api", { parent: "two" })]);
  expect(only(diffDiagrams(twins, moved)).fields).toEqual([{ label: "Inside", before: "Service", after: "Service" }]);
});

test("tags that only read the same are still different", () => {
  const change = only(diff([objectUpdate("db", { tags: ["Postgre", "SQL"] })]));
  expect(change.fields).toEqual([{ label: "Tags", before: "PostgreSQL", after: "Postgre, SQL" }]);
  const joined = applyOperations(diagram, [objectUpdate("db", { tags: ["a, b"] })]);
  const split = applyOperations(diagram, [objectUpdate("db", { tags: ["a", "b"] })]);
  expect(diffDiagrams(joined, split)).toHaveLength(1);
});
