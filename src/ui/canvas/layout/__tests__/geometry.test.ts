import { expect, test } from "vitest";
import { boundary, component, diagramOf } from "../../../../test/fixtures";
import type { CanvasNode } from "../../nodes/nodeTypes";
import { absolutePosition, boundaryUnder, snapToNeighbours } from "../geometry";

const diagram = diagramOf([
  boundary("payments", { position: { x: 100, y: 100 }, name: "Payments" }),
  component("api", "API", "service", { position: { x: 150, y: 180 }, parent: "payments" }),
  component("web", "Web", "webClient", { position: { x: 700, y: 180 } }),
]);
const node = (id: string, x: number, y: number, parentId?: string) =>
  ({ id, position: { x, y }, parentId, measured: { width: 200, height: 60 }, data: {} }) as unknown as CanvasNode;

test("a node inside a boundary is placed relative to it; the diagram keeps it absolute", () => {
  expect(absolutePosition(diagram, node("api", 50, 80, "payments"))).toEqual({ x: 150, y: 180 });
  expect(absolutePosition(diagram, node("web", 700, 180))).toEqual({ x: 700, y: 180 });
});

test("a node dropped with its centre in a boundary lands in it, but never in itself or its own contents", () => {
  expect(boundaryUnder(diagram, { id: "web", position: { x: 200, y: 200 }, width: 200, height: 60 })).toBe("payments");
  expect(boundaryUnder(diagram, { id: "web", position: { x: 900, y: 200 }, width: 200, height: 60 })).toBeNull();
  expect(boundaryUnder(diagram, { id: "payments", position: { x: 100, y: 100 }, width: 400, height: 300 })).toBeNull();
});

test("a boundary dropped in the same move counts where it now is", () => {
  const moved = [{ id: "payments", position: { x: 1000, y: 1000 } }];
  expect(boundaryUnder(diagram, { id: "web", position: { x: 200, y: 200 }, width: 200, height: 60 }, moved)).toBeNull();
});

test("a node dragged near a neighbour snaps level with it, in its own coordinates", () => {
  const nodes = [node("api", 50, 80, "payments"), node("web", 700, 180)];
  expect(snapToNeighbours(diagram, nodes, "web", { x: 700, y: 184 }).position).toEqual({ x: 700, y: 180 });
});
