import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { NewDiagramObject } from "../../../../diagram/schema";
import { component, diagram, seed, selection, undoLabels } from "../../../../test/diagram";
import type { Point } from "../../layout/placement";
import { useAddNode } from "../useAddNode";

const flow = vi.hoisted(() => ({
  screenToFlowPosition: (point: { x: number; y: number }) => point,
  flowToScreenPosition: (point: { x: number; y: number }) => point,
  fitView: vi.fn(),
  getZoom: () => 1,
  getNode: vi.fn((_id: string): object | undefined => undefined),
}));
vi.mock("@xyflow/react", () => ({ useReactFlow: () => flow }));

const rectangle: NewDiagramObject = { type: "rectangle", text: "" };
const middle = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
// Positions are top-left corners, and a new rectangle is taken to be 160 by 96.
const cornerOf = (centre: Point) => ({ x: centre.x - 80, y: centre.y - 48 });

function add(object: NewDiagramObject = rectangle, at?: Point) {
  renderHook(() => useAddNode()).result.current(object, at);
  return diagram().objects[diagram().objects.length - 1];
}

test("adds the object centred in the window and selects it", () => {
  const added = add();
  expect(added).toMatchObject({ type: "rectangle", text: "", position: cornerOf(middle) });
  expect(added.id).toBeTruthy();
  expect(selection()).toEqual([added.id]);
});

test("each object gets its own id, and the newest is the one selected", () => {
  const first = add();
  const second = add();
  expect(second.id).not.toBe(first.id);
  expect(selection()).toEqual([second.id]);
});

test("finds a free spot beside whatever is in the way, even if the canvas has not drawn it yet", () => {
  add();
  // A rectangle is taken to be 160 wide until measured, and objects keep a 24px gap.
  expect(add().position).toEqual(cornerOf({ x: middle.x + 184, y: middle.y }));
});

test("uses the size the canvas measured for what is already there", () => {
  add();
  flow.getNode.mockReturnValueOnce({ measured: { width: 400, height: 96 } });
  expect(add().position).toEqual(cornerOf({ x: middle.x - 184, y: middle.y }));
});

test("a dropped object is centred where it was dropped", () => {
  add();
  expect(add(rectangle, middle).position).toEqual(cornerOf(middle));
});

test("the undo step is named after what was added", () => {
  add({ type: "component", kind: "loadBalancer", name: "Load Balancer", options: {} });
  add({ type: "text", text: "Text" });
  expect(undoLabels()).toEqual(["Add load balancer", "Add text"]);
});

const group = {
  type: "boundary" as const,
  id: "g",
  position: { x: 1000, y: 1000 },
  size: { width: 400, height: 260 },
  name: "Payments",
};

test("with a boundary selected, new things go inside it, lined up in a row from its top left", () => {
  seed([group], [], ["g"]);
  const first = add();
  expect(first).toMatchObject({ parent: "g", position: { x: 1000 + 24, y: 1000 + 48 } });
  expect(selection()).toEqual([first.id]);
  const second = add();
  expect(second).toMatchObject({ parent: "g", position: { x: 1024 + 160 + 40, y: 1048 } });
});

test("with something in a group selected, a new thing goes in that group too", () => {
  seed([group, component("api", "API", "service", { position: { x: 1020, y: 1060 }, parent: "g" })], [], ["api"]);
  expect(add().parent).toBe("g");
});

test("a boundary added into another leaves that one selected, so its siblings can be added one after another", () => {
  seed([group], [], ["g"]);
  const first = add({ type: "boundary", name: "", size: { width: 400, height: 260 }, kind: "service" });
  const second = add({ type: "boundary", name: "", size: { width: 400, height: 260 }, kind: "service" });
  expect([first.parent, second.parent]).toEqual(["g", "g"]);
  expect(selection()).toEqual(["g"]);
});

test("dropping onto a group puts it inside", () => {
  seed([group]);
  expect(add(rectangle, { x: 1100, y: 1100 }).parent).toBe("g");
});

test("something added out of sight brings its boundary into view, without zooming in", async () => {
  seed([{ ...group, position: { x: 5000, y: 5000 } }], [], ["g"]);
  flow.fitView.mockClear();
  add();
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(flow.fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: [{ id: "g" }], maxZoom: 1 }));
});

test("something added in sight leaves the view alone", async () => {
  flow.fitView.mockClear();
  add();
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(flow.fitView).not.toHaveBeenCalled();
});
