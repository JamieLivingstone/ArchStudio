import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { button } from "../../../../test/dom";
import { ViewControls } from "../ViewControls";

const view = vi.hoisted(() => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), zoomTo: vi.fn() }));
const fitDiagram = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useFitDiagram", () => ({ useFitDiagram: () => fitDiagram }));
vi.mock("@xyflow/react", () => ({
  useReactFlow: () => view,
  useStore: (select: (state: { transform: number[] }) => unknown) => select({ transform: [0, 0, 0.456] }),
  MiniMap: () => <div data-testid="map" />,
}));

beforeEach(() => vi.clearAllMocks());

test("shows the zoom level and zooms in, out, to 100% and to fit", async () => {
  render(<ViewControls />);
  expect(button("Zoom to 100%").textContent).toBe("46%");

  await userEvent.click(button("Zoom in"));
  await userEvent.click(button("Zoom out"));
  await userEvent.click(button("Zoom to 100%"));
  await userEvent.click(button("Fit to window"));
  expect(view.zoomIn).toHaveBeenCalledTimes(1);
  expect(view.zoomOut).toHaveBeenCalledTimes(1);
  expect(view.zoomTo).toHaveBeenCalledWith(1, { duration: 150 });
  expect(fitDiagram).toHaveBeenCalledTimes(1);
});

test("the map is hidden until asked for", async () => {
  render(<ViewControls />);
  expect(screen.queryByTestId("map")).toBeNull();
  await userEvent.click(button("Show map"));
  expect(screen.getByTestId("map")).toBeTruthy();
  await userEvent.click(button("Hide map"));
  expect(screen.queryByTestId("map")).toBeNull();
});
