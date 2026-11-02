import { describe, expect, test } from "vitest";
import { boundary, codes, component, diagramOf, objectAdd, objectRemove, objectUpdate } from "../../test/fixtures";
import { applyOperations } from "../apply";
import { boundaryKindNames } from "../boundaryKinds";
import { describeDiagram } from "../describe";
import { ancestorsOf, boundaryAt, descendantsOf, parentsFirst } from "../hierarchy";
import type { DiagramOperation } from "../operations";
import type { Boundary, Diagram, DiagramObject } from "../schema";
import { validateDiagram, validateOperation } from "../validate";

const group = (id: string, x: number, y: number, extra: Partial<Boundary> = {}) =>
  boundary(id, { position: { x, y }, ...extra });
const service = (id: string, parent?: string) =>
  component(id, id, "service", { position: { x: 50, y: 80 }, ...(parent ? { parent } : {}) });

const nested = (): Diagram =>
  diagramOf([
    group("checkout", 0, 0, { kind: "team", size: { width: 800, height: 600 } }),
    group("payments", 40, 60, { kind: "service", parent: "checkout" }),
    service("api", "payments"),
    service("web"),
  ]);
const check = (operation: DiagramOperation, diagram = nested()) => codes(validateOperation(diagram, operation));

describe("boundaries", () => {
  test("a nested diagram is valid, whatever order its objects are listed in", () => {
    expect(validateDiagram(nested())).toEqual([]);
    expect(validateDiagram({ ...nested(), objects: [...nested().objects].reverse() })).toEqual([]);
  });

  test("a boundary is complete with just a name and a size; its kind is optional and from a short list", () => {
    expect(check(objectAdd(group("zone", 0, 0)))).toEqual([]);
    expect(boundaryKindNames).toEqual(["service", "team", "domain", "trustZone", "region"]);
    expect(check(objectUpdate("payments", { kind: "trustZone" }))).toEqual([]);
    expect(check(objectUpdate("payments", { kind: null }))).toEqual([]);
    expect(check(objectUpdate("payments", { kind: "database" }))).toEqual(["invalid_kind"]);
    expect(check(objectUpdate("web", { kind: "team" }))).toEqual(["invalid_kind"]);
  });

  test("a boundary has a name, description, tags and icon, but no text or details", () => {
    expect(check(objectUpdate("payments", { name: "Payments", description: "Takes money" }))).toEqual([]);
    expect(check(objectUpdate("payments", { text: "x" }))).toEqual(["field_not_applicable"]);
    expect(check(objectUpdate("payments", { options: {} }))).toEqual(["field_not_applicable"]);
  });

  test("anything can be put into a boundary, or taken out", () => {
    const moved = applyOperations(nested(), [objectUpdate("web", { parent: "payments" })]);
    expect(moved.objects[3]).toMatchObject({ parent: "payments" });
    const out = applyOperations(moved, [objectUpdate("web", { parent: null })]);
    expect(out.objects[3]).not.toHaveProperty("parent");
  });

  test("only a boundary that exists can contain things, and never itself or something it contains", () => {
    expect(check(objectUpdate("web", { parent: "api" }))).toEqual(["invalid_parent"]);
    expect(check(objectUpdate("web", { parent: "nowhere" }))).toEqual(["unknown_object"]);
    expect(check(objectUpdate("payments", { parent: "payments" }))).toEqual(["invalid_parent"]);
    expect(check(objectUpdate("checkout", { parent: "payments" }))).toEqual(["invalid_parent"]);
    expect(check(objectAdd(service("new", "web")))).toEqual(["invalid_parent"]);
  });

  test("removing a boundary keeps what it contains, which moves up to the boundary's own parent", () => {
    const next = applyOperations(nested(), [objectRemove("payments")]);
    expect(next.objects.find((object) => object.id === "api")).toMatchObject({ parent: "checkout" });
    const top = applyOperations(next, [objectRemove("checkout")]);
    expect(top.objects.find((object) => object.id === "api")).not.toHaveProperty("parent");
    expect(validateDiagram(top)).toEqual([]);
  });

  test("connections can start or end at a boundary", () => {
    const connection = {
      id: "c",
      from: "web",
      to: "payments",
      label: "",
      direction: "forward",
      line: "solid",
    } as const;
    expect(check({ type: "connection.add", connection })).toEqual([]);
  });
});

describe("hierarchy", () => {
  const diagram = nested();
  const ids = (objects: DiagramObject[]) => objects.map((object) => object.id);

  test("finds what is inside a boundary at any depth, and what an object is inside", () => {
    expect(ids(descendantsOf(diagram, "checkout"))).toEqual(["payments", "api"]);
    expect(ids(ancestorsOf(diagram, diagram.objects[2]))).toEqual(["payments", "checkout"]);
  });

  test("a parent loop, as a damaged file might hold, is reported and never hangs", () => {
    const looped: Diagram = {
      ...diagram,
      objects: [group("a", 0, 0, { parent: "b" }), group("b", 0, 0, { parent: "a" })],
    };
    expect(ids(descendantsOf(looped, "a"))).toEqual(["b"]);
    expect(ids(ancestorsOf(looped, looped.objects[0]))).toEqual(["b"]);
    expect(codes(validateDiagram(looped))).toEqual(["invalid_parent", "invalid_parent"]);
  });

  test("puts each boundary before what it contains", () => {
    const reversed = { ...diagram, objects: [...diagram.objects].reverse() };
    const order = ids(parentsFirst(reversed));
    expect(order.indexOf("checkout")).toBeLessThan(order.indexOf("payments"));
    expect(order.indexOf("payments")).toBeLessThan(order.indexOf("api"));
  });

  test("the innermost boundary under a point is where a dropped thing goes", () => {
    expect(boundaryAt(diagram, { x: 100, y: 100 })?.id).toBe("payments");
    expect(boundaryAt(diagram, { x: 700, y: 500 })?.id).toBe("checkout");
    expect(boundaryAt(diagram, { x: 900, y: 900 })).toBeUndefined();
    expect(boundaryAt(diagram, { x: 100, y: 100 }, new Set(["payments"]))?.id).toBe("checkout");
  });
});

test("a model reads boundaries, their kind and what is inside them; positions and sizes are left out", () => {
  const text = describeDiagram(nested());
  expect(text).toContain(
    'Boundaries:\n- [checkout] "checkout" (Team boundary)\n- [payments] "payments" (Service boundary). Inside [checkout]',
  );
  expect(text).toContain('- [api] "api" (Service). Inside [payments]');
  expect(text).not.toMatch(/width|height|position/);
});
