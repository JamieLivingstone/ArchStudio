import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { fitOptions, useFitDiagram } from "../useFitDiagram";

const flow = vi.hoisted(() => ({
  getNodes: vi.fn(() => [{ id: "a" }]),
  getNodesBounds: () => ({ x: 0, y: 0, width: 4000, height: 200 }),
  setViewport: vi.fn(),
}));
const pane = vi.hoisted(() => ({ width: 1000, height: 600 }));
vi.mock("@xyflow/react", () => ({ useReactFlow: () => flow, useStoreApi: () => ({ getState: () => pane }) }));

test("a diagram too wide to read whole starts from its left edge, centred top to bottom", async () => {
  const { result } = renderHook(() => useFitDiagram());
  await result.current({ duration: 0 });
  expect(flow.setViewport).toHaveBeenCalledWith({ x: 80, y: 242, zoom: 0.3 }, { duration: 0 });
});

test("does nothing without nodes", async () => {
  flow.setViewport.mockClear();
  flow.getNodes.mockReturnValueOnce([]);
  const { result } = renderHook(() => useFitDiagram());
  await result.current();
  expect(flow.setViewport).not.toHaveBeenCalled();
});

test("fitting keeps clear of the inspector while it is open", () => {
  expect(fitOptions().padding.right).toBe(80);
  const inspector = document.createElement("div");
  inspector.dataset.inspector = "";
  document.body.append(inspector);
  expect(fitOptions().padding.right).toBe(130);
  inspector.setAttribute("inert", "");
  expect(fitOptions().padding.right).toBe(80);
  inspector.remove();
});

test("on a phone, fitting clears the sheet along the bottom and stops at a readable zoom", () => {
  const width = window.innerWidth;
  window.innerWidth = 375;
  expect(fitOptions().minZoom).toBe(0.5);
  expect(fitOptions().padding.bottom).toBe(72);
  const inspector = document.createElement("div");
  inspector.dataset.inspector = "";
  Object.defineProperty(inspector, "offsetHeight", { value: 400 });
  document.body.append(inspector);
  expect(fitOptions().padding.bottom).toBe(416);
  expect(fitOptions().padding.right).toBe(16);
  inspector.remove();
  window.innerWidth = width;
});
