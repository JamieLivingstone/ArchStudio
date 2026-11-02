import { expect, test } from "vitest";
import type { Diagram } from "../../../diagram/schema";
import { boundary, component, connection, diagramOf, shape } from "../../../test/diagram";
import { ARROW } from "../edges/ConnectionEdge";
import { toEdges, toNodes } from "../projection";

const lb = component("lb", "Edge LB", "loadBalancer", { options: { sticky: true } });
const box = shape("box", "Zone");
const line = connection("line", "lb", "box", "HTTPS");
const diagram: Diagram = diagramOf([lb, box], [line]);

test("a component becomes a component node, and a shape a node of its type", () => {
  const [first, rectangle] = toNodes(diagram, ["box"], []);
  expect(first).toMatchObject({
    id: "lb",
    type: "component",
    position: lb.position,
    data: { label: "Edge LB", kind: "loadBalancer", options: { sticky: true }, tags: [] },
    selected: false,
  });
  expect(rectangle).toMatchObject({
    id: "box",
    type: "rectangle",
    data: { label: "Zone" },
    selected: true,
  });
});

test("a node keeps the size React Flow measured, and removed objects drop out", () => {
  const first = toNodes(diagram, [], []).map((node) => ({
    ...node,
    measured: { width: 192, height: 60 },
  }));
  const [node] = toNodes({ ...diagram, objects: [lb] }, ["lb"], first);
  expect(node.measured).toEqual({ width: 192, height: 60 });
});

test("a connection becomes an edge between its two objects", () => {
  const [edge] = toEdges(diagram, []);
  expect(edge).toMatchObject({
    id: "line",
    type: "connection",
    source: "lb",
    target: "box",
    label: "HTTPS",
    markerEnd: ARROW,
    animated: false,
    selected: false,
  });
  expect(edge.markerStart).toBeUndefined();
  expect(edge.style).toBeUndefined();
});

test("a connection leaves the right side and enters the left unless it names its sides", () => {
  const [plain] = toEdges(diagram, []);
  expect(plain).toMatchObject({ sourceHandle: "right", targetHandle: "left" });
  const [sided] = toEdges({ ...diagram, connections: [{ ...line, fromSide: "bottom", toSide: "top" }] }, []);
  expect(sided).toMatchObject({ sourceHandle: "bottom", targetHandle: "top" });
});

test.each([
  ["backward", { markerStart: ARROW, markerEnd: undefined }],
  ["both", { markerStart: ARROW, markerEnd: ARROW }],
  ["none", { markerStart: undefined, markerEnd: undefined }],
] as const)("a %s connection has the right arrowheads", (direction, markers) => {
  const [edge] = toEdges({ ...diagram, connections: [{ ...line, direction }] }, []);
  expect({ markerStart: edge.markerStart, markerEnd: edge.markerEnd }).toEqual(markers);
});

test("dashed and flow lines are drawn as such", () => {
  const [dashed] = toEdges({ ...diagram, connections: [{ ...line, line: "dashed" }] }, []);
  expect(dashed.style).toEqual({ strokeDasharray: "6 4" });
  const [flow] = toEdges({ ...diagram, connections: [{ ...line, line: "flow" }] }, []);
  expect(flow.animated).toBe(true);
});

test("selected connections are marked", () => {
  expect(toEdges(diagram, ["line"])[0].selected).toBe(true);
});

test("rectangles get a starting size until resized; components, text and spheres size themselves", () => {
  const big = shape("big", "big", "rectangle", { size: { width: 300, height: 200 } });
  const sized = diagramOf([component("c"), shape("r"), shape("s", "", "sphere"), shape("t", "", "text"), big]);
  const sizes = toNodes(sized, [], []).map(({ width, height }) => ({ width, height }));
  expect(sizes).toEqual([
    { width: undefined, height: undefined },
    { width: 160, height: 96 },
    { width: undefined, height: undefined },
    { width: undefined, height: undefined },
    { width: 300, height: 200 },
  ]);
});

test("what is inside a group comes after it, placed relative to it", () => {
  const grouped = diagramOf([
    component("api", "api", undefined, { position: { x: 150, y: 180 }, parent: "payments" }),
    boundary("payments", { position: { x: 100, y: 100 }, name: "Payments" }),
  ]);
  const nodes = toNodes(grouped, [], []);
  expect(nodes.map((node) => node.id)).toEqual(["payments", "api"]);
  expect(nodes[0]).toMatchObject({ type: "boundary", width: 400, height: 300, position: { x: 100, y: 100 } });
  expect(nodes[1]).toMatchObject({ parentId: "payments", position: { x: 50, y: 80 } });
});

test("a rectangle laid out as a card fits its content until it is resized", () => {
  const card = shape("card", "card", "rectangle", { description: "Charges cards." });
  const resized = { ...card, id: "resized", size: { width: 300, height: 200 } };
  const sizes = toNodes(diagramOf([card, resized]), [], []).map(({ width, height }) => ({ width, height }));
  expect(sizes).toEqual([
    { width: undefined, height: undefined },
    { width: 300, height: 200 },
  ]);
});

test("a boundary can only be dragged once it is selected, so dragging across it otherwise pans", () => {
  const framed: Diagram = diagramOf([lb, boundary("zone", { name: "Zone" })]);
  const draggable = (selection: string[]) =>
    toNodes(framed, selection, []).map((node) => [node.id, "draggable" in node ? node.draggable : "default"]);
  expect(draggable([])).toEqual([
    ["lb", "default"],
    ["zone", false],
  ]);
  expect(draggable(["zone"])).toEqual([
    ["lb", "default"],
    ["zone", "default"],
  ]);
});
