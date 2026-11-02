import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { beforeEach, expect, test, vi } from "vitest";
import { seed } from "../../../../test/diagram";
import { button } from "../../../../test/dom";
import { type CanvasTool, Sidebar } from "../Sidebar";

const addNode = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useAddNode", () => ({ useAddNode: () => addNode }));

beforeEach(() => addNode.mockClear());

function setup(tool: CanvasTool = "move") {
  const onOpenSettings = vi.fn();
  const onToolChange = vi.fn();
  render(
    <ReactFlowProvider>
      <Sidebar tool={tool} onToolChange={onToolChange} onOpenSettings={onOpenSettings} />
    </ReactFlowProvider>,
  );
  const components = button("Components");
  return {
    onOpenSettings,
    onToolChange,
    components,
    picker: () => screen.queryByRole("searchbox"),
  };
}

test("double-clicking a shape button adds its node", async () => {
  setup();
  await userEvent.dblClick(button("Text"));
  await userEvent.dblClick(button("Rectangle"));
  await userEvent.dblClick(button("Sphere"));
  expect(addNode.mock.calls).toEqual([
    [{ type: "text", text: "Text" }],
    [{ type: "rectangle", text: "" }],
    [{ type: "sphere", text: "" }],
  ]);
});

test("a single click on a shape button adds nothing", async () => {
  setup();
  await userEvent.click(button("Rectangle"));
  expect(addNode).not.toHaveBeenCalled();
});

test("dragging a shape button onto the canvas adds it where it is dropped", () => {
  setup();
  const canvas = document.createElement("div");
  canvas.className = "react-flow";
  document.body.append(canvas);
  document.elementFromPoint = () => canvas;

  fireEvent.pointerDown(button("Sphere"), {
    clientX: 30,
    clientY: 160,
  });
  fireEvent.pointerMove(document, { clientX: 400, clientY: 300 });
  expect(screen.getByTestId("drag-ghost").textContent).toBe("Sphere");
  fireEvent.pointerUp(document, { clientX: 400, clientY: 300 });

  expect(addNode).toHaveBeenCalledWith(expect.objectContaining({ type: "sphere" }), {
    x: 400,
    y: 300,
  });
  canvas.remove();
});

test("the Components button toggles the picker", async () => {
  const { components, picker } = setup();
  expect(picker()).toBeNull();
  await userEvent.click(components);
  expect(picker()).not.toBeNull();
  expect(components.getAttribute("aria-expanded")).toBe("true");
  await userEvent.click(components);
  expect(picker()).toBeNull();
});

test("picking a component adds it and keeps the picker open", async () => {
  const { components, picker } = setup();
  await userEvent.click(components);
  await userEvent.dblClick(button("Mobile App"));
  expect(addNode).toHaveBeenCalledWith({
    type: "component",
    kind: "mobileApp",
    name: "Mobile App",
    options: {},
  });
  expect(picker()).not.toBeNull();
});

test("Escape or a press outside closes the picker", async () => {
  const { components, picker } = setup();
  await userEvent.click(components);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(picker()).toBeNull();

  await userEvent.click(components);
  fireEvent.pointerDown(document.body);
  expect(picker()).toBeNull();
});

test("the Settings button opens settings and closes the picker", async () => {
  const { components, picker, onOpenSettings } = setup();
  await userEvent.click(components);
  await userEvent.click(button("Settings"));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
  expect(picker()).toBeNull();
});

test("shows which canvas tool is active and switches between them", async () => {
  const { onToolChange } = setup("move");
  const select = button("Select");
  const move = button("Move");
  expect(select.getAttribute("aria-pressed")).toBe("false");
  expect(move.getAttribute("aria-pressed")).toBe("true");

  await userEvent.click(select);
  expect(onToolChange).toHaveBeenCalledWith("select");
  await userEvent.click(move);
  expect(onToolChange).toHaveBeenLastCalledWith("move");
});

test("the move tool comes first", () => {
  setup();
  const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
  expect(names.slice(0, 2)).toEqual(["Move", "Select"]);
});

test("the Boundaries button opens a picker of boundary kinds, each explained, in place of the components", async () => {
  const { components } = setup();
  await userEvent.click(components);
  await userEvent.click(button("Boundaries"));
  expect(screen.queryByRole("searchbox")).toBeNull();
  const boundaries = screen.getByRole("region", { name: "Boundaries" });
  const titles = [...boundaries.querySelectorAll("button")].map(
    (button) => button.querySelector("span span")?.textContent,
  );
  expect(titles).toEqual(["Boundary", "Service", "Team", "Domain", "Trust zone", "Region"]);
  expect(boundaries.textContent).toContain("What one team owns");
});

test("double-clicking a boundary kind adds a boundary of that kind, and the plain one adds one with none", async () => {
  setup();
  await userEvent.click(button("Boundaries"));
  await userEvent.dblClick(button(/^Team/));
  await userEvent.dblClick(button(/^Boundary\s*A plain frame/));
  expect(addNode.mock.calls.map(([node]) => node)).toEqual([
    { type: "boundary", name: "", size: { width: 320, height: 200 }, kind: "team" },
    { type: "boundary", name: "", size: { width: 320, height: 200 } },
  ]);
});

test("with a boundary selected, the pickers say what things will be added to, and × adds to the canvas instead", async () => {
  seed(
    [{ type: "boundary", id: "g", position: { x: 0, y: 0 }, size: { width: 400, height: 260 }, name: "Payments" }],
    [],
    ["g"],
  );
  const { components } = setup();
  await userEvent.click(components);
  expect(screen.getByRole("region", { name: "Components" }).textContent).toContain("Adding to Payments");
  await userEvent.click(button("Add to the canvas instead"));
  expect(screen.queryByText("Adding to")).toBeNull();
  expect(screen.getByRole("searchbox")).toBeTruthy();
});
