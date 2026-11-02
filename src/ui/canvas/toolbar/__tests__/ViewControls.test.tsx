import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { button } from "../../../../test/dom";
import { fitOptions, ViewControls } from "../ViewControls";

const view = vi.hoisted(() => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), zoomTo: vi.fn(), fitView: vi.fn() }));
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
  expect(view.fitView).toHaveBeenCalledWith(fitOptions());
});

test("the map is hidden until asked for", async () => {
  render(<ViewControls />);
  expect(screen.queryByTestId("map")).toBeNull();
  await userEvent.click(button("Show map"));
  expect(screen.getByTestId("map")).toBeTruthy();
  await userEvent.click(button("Hide map"));
  expect(screen.queryByTestId("map")).toBeNull();
});

test("fitting keeps clear of the inspector while it is open", () => {
  expect(fitOptions().padding.right).toBe("80px");
  const inspector = document.createElement("div");
  inspector.dataset.inspector = "";
  document.body.append(inspector);
  expect(fitOptions().padding.right).toBe("130px");
  inspector.setAttribute("inert", "");
  expect(fitOptions().padding.right).toBe("80px");
  inspector.remove();
});
