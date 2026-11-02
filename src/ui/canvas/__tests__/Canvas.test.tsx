import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { component, connection, diagramOf, objectAdd, objectRemove, objectUpdate } from "../../../test/diagram";
import { button, modelSelection } from "../../../test/dom";
import { focusOn, getAppState, hasUnsavedChanges, loadDiagram, propose, rejectProposal, select } from "../../state";
import { Canvas } from "../Canvas";

function setup() {
  const onOpenSettings = vi.fn();
  const { container } = render(
    <div style={{ width: 800, height: 600 }}>
      <Canvas theme="light" modelSelection={modelSelection()} onOpenSettings={onOpenSettings} />
    </div>,
  );
  const nodes = () => [...container.querySelectorAll<HTMLElement>(".react-flow__node")];
  return { onOpenSettings, container, nodes, user: userEvent.setup() };
}

test("starts empty with the toolbar, history controls and assistant button", () => {
  const { nodes, container } = setup();
  expect(nodes()).toEqual([]);
  button("Rectangle");
  button("Show panel");
  expect(button("Undo").disabled).toBe(true);
  expect(container.querySelector(".react-flow")?.classList.contains("light")).toBe(true);
});

test("adds nodes from the toolbar, selecting the newest", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Rectangle"));
  await user.click(button("Components"));
  await user.dblClick(button("Load Balancer"));

  await waitFor(() => expect(nodes()).toHaveLength(2));
  const [rectangle, loadBalancer] = nodes();
  expect(rectangle.classList.contains("react-flow__node-rectangle")).toBe(true);
  expect(within(loadBalancer).getAllByText("Load Balancer")).toHaveLength(2);
  expect(rectangle.classList.contains("selected")).toBe(false);
  expect(loadBalancer.classList.contains("selected")).toBe(true);
});

test("an added node can be undone and redone", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Sphere"));
  await waitFor(() => expect(nodes()).toHaveLength(1));

  await user.click(button("Undo"));
  await waitFor(() => expect(nodes()).toEqual([]));
  expect(button("Redo").disabled).toBe(false);

  await user.click(button("Redo"));
  await waitFor(() => expect(nodes()).toHaveLength(1));
});

test("the toolbar's Settings button asks to open settings", async () => {
  const { onOpenSettings, user } = setup();
  await user.click(button("Settings"));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

test("Cmd/Ctrl+A selects every node", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Rectangle"));
  await user.dblClick(button("Sphere"));
  await waitFor(() => expect(nodes()).toHaveLength(2));
  const selected = () => nodes().map((node) => node.classList.contains("selected"));
  expect(selected()).toEqual([false, true]);

  fireEvent.keyDown(document, { key: "a", metaKey: true });
  await waitFor(() => expect(selected()).toEqual([true, true]));
});

test("Cmd/Ctrl+A in a text field is left to the field", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Rectangle"));
  await user.dblClick(button("Sphere"));
  await waitFor(() => expect(nodes()).toHaveLength(2));

  await user.click(screen.getByRole("tab", { name: "Assistant" }));
  const event = new KeyboardEvent("keydown", {
    key: "a",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  screen.getByRole("textbox", { name: "Message" }).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(nodes()[0].classList.contains("selected")).toBe(false);
});

test("the move tool is the default; the select tool stops the canvas being draggable", async () => {
  const { container, user } = setup();
  const pane = container.querySelector(".react-flow__pane") as HTMLElement;
  const pressed = (name: string) => button(name).getAttribute("aria-pressed");
  expect(pressed("Move")).toBe("true");
  expect(pane.classList.contains("draggable")).toBe(true);

  await user.click(button("Select"));
  expect(pressed("Select")).toBe("true");
  expect(pressed("Move")).toBe("false");
  expect(pane.classList.contains("draggable")).toBe(false);
});

test("V and H switch tools, except while typing", async () => {
  const { user } = setup();
  const pressed = (name: string) => button(name).getAttribute("aria-pressed");
  fireEvent.keyDown(document, { key: "V" });
  expect(pressed("Select")).toBe("true");
  fireEvent.keyDown(document, { key: "h" });
  expect(pressed("Move")).toBe("true");
  fireEvent.keyDown(document, { key: "v" });

  await user.click(button("Show panel"));
  await user.type(screen.getByRole("textbox", { name: "Message" }), "h");
  expect(pressed("Select")).toBe("true");
});

test("adding a node opens the inspector on its properties, where it can be deleted", async () => {
  const { nodes, user } = setup();
  await user.click(button("Components"));
  await user.dblClick(button("Load Balancer"));
  await waitFor(() => expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Properties"));
  screen.getByRole("region", { name: "Load Balancer details" });

  await user.click(button("Delete"));
  await waitFor(() => expect(nodes()).toEqual([]));
  expect(screen.queryByRole("tab")).toBeNull();
});

test("Cmd/Ctrl+C and Cmd/Ctrl+V copy and paste the selected nodes", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Rectangle"));
  await user.dblClick(button("Sphere"));
  await waitFor(() => expect(nodes()).toHaveLength(2));
  fireEvent.keyDown(document, { key: "a", metaKey: true });

  fireEvent.keyDown(document, { key: "c", metaKey: true });
  fireEvent.keyDown(document, { key: "v", ctrlKey: true });
  await waitFor(() => expect(nodes()).toHaveLength(4));
  expect(nodes().map((node) => node.classList.contains("selected"))).toEqual([false, false, true, true]);

  await user.click(button("Undo"));
  await waitFor(() => expect(nodes()).toHaveLength(2));
});

test("Cmd/Ctrl+X cuts the selected nodes", async () => {
  const { nodes, user } = setup();
  await user.dblClick(button("Rectangle"));
  await waitFor(() => expect(nodes()).toHaveLength(1));
  fireEvent.keyDown(document, { key: "x", metaKey: true });
  await waitFor(() => expect(nodes()).toHaveLength(0));
  fireEvent.keyDown(document, { key: "v", metaKey: true });
  await waitFor(() => expect(nodes()).toHaveLength(1));
});

test("an edit made in the inspector shows on the node and can be undone", async () => {
  const { nodes, user } = setup();
  await user.click(button("Components"));
  await user.dblClick(button("Load Balancer"));
  await waitFor(() => expect(nodes()).toHaveLength(1));

  await user.click(within(screen.getByRole("group", { name: "Sticky sessions" })).getByRole("button", { name: "On" }));
  await waitFor(() => within(nodes()[0]).getByText("Sticky sessions"));

  await user.click(button("Undo"));
  await waitFor(() => expect(within(nodes()[0]).queryByText("Sticky sessions")).toBeNull());
  expect(nodes()).toHaveLength(1);
});

test("arrow keys nudge the selected node, further with Shift", async () => {
  const { user } = setup();
  await user.dblClick(button("Rectangle"));
  const [rectangle] = getAppState().diagram.objects;
  const start = rectangle.position;

  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.keyDown(document, { key: "ArrowDown", shiftKey: true });
  expect(getAppState().diagram.objects[0].position).toEqual({ x: start.x + 1, y: start.y + 10 });
});

test("arrow keys do nothing with nothing selected, or while typing", async () => {
  const { user } = setup();
  await user.dblClick(button("Rectangle"));
  const position = getAppState().diagram.objects[0].position;

  await user.click(screen.getByRole("tab", { name: "Properties" }));
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "ArrowLeft" });
  select([]);
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  expect(getAppState().diagram.objects[0].position).toEqual(position);
});

test("a diagram loaded to be arranged is laid out and brought into view before it is shown", async () => {
  const at = (x: number, id: string) => component(id, id, undefined, { position: { x, y: 400 } });
  loadDiagram(
    diagramOf(
      [at(700, "web"), at(100, "api"), at(400, "db")],
      [connection("c1", "web", "api"), connection("c2", "api", "db")],
    ),
  );
  const { container } = render(
    <div style={{ width: 800, height: 600 }}>
      <Canvas theme="light" modelSelection={modelSelection()} onOpenSettings={vi.fn()} arrangeOnLoad />
    </div>,
  );
  const hidden = () => container.querySelector(".react-flow")?.classList.contains("arranging");
  const x = (id: string) => getAppState().diagram.objects.find((object) => object.id === id)?.position.x ?? 0;
  await waitFor(() => expect(x("web")).toBeLessThan(x("api")), { interval: 10 });
  expect(x("api")).toBeLessThan(x("db"));
  expect(hidden()).toBe(true);
  await waitFor(() => expect(hidden()).toBe(false));
  await waitFor(() => expect(hasUnsavedChanges(getAppState())).toBe(false));
  expect(getAppState().undoSteps).toEqual([]);
});

test("a pending proposal is drawn on the canvas, marked by what it would do, until it is decided", async () => {
  loadDiagram(diagramOf([component("web"), component("api")], [connection("c1", "web", "api")]));
  const { container } = render(
    <div style={{ width: 800, height: 600 }}>
      <Canvas theme="light" modelSelection={modelSelection()} onOpenSettings={vi.fn()} />
    </div>,
  );
  const marked = (id: string) => container.querySelector(`[data-id="${id}"]`)?.className.match(/proposed-\S+/g) ?? [];

  act(() => {
    propose([objectAdd(component("cache")), objectUpdate("web", { name: "Site" }), objectRemove("api")]);
  });
  await waitFor(() => expect(marked("cache")).toEqual(["proposed-added"]));
  expect(marked("web")).toEqual(["proposed-changed"]);
  expect(marked("api")).toEqual(["proposed-removed"]);
  expect(getAppState().diagram.objects).toHaveLength(2);

  act(() => focusOn("cache"));
  await waitFor(() => expect(marked("cache")).toEqual(["proposed-added", "proposed-focus"]));

  act(() => rejectProposal());
  await waitFor(() => expect(container.querySelector('[data-id="cache"]')).toBeNull());
  expect(marked("api")).toEqual([]);
});

test("with a dialog open, keys do nothing to the canvas behind it", () => {
  loadDiagram(diagramOf([component("web")]));
  render(
    <div style={{ width: 800, height: 600 }}>
      <Canvas theme="light" modelSelection={modelSelection()} onOpenSettings={vi.fn()} />
      <dialog open>
        <button type="button">Cancel</button>
      </dialog>
    </div>,
  );
  act(() => select(["web"]));
  fireEvent.keyDown(button("Cancel"), { key: "ArrowRight" });
  fireEvent.keyDown(document, { key: "z", metaKey: true });
  expect(getAppState().diagram.objects[0].position).toEqual({ x: 0, y: 0 });
});

test("while a proposal is on the canvas, keys do not edit the diagram behind it", () => {
  loadDiagram(diagramOf([component("web")]));
  render(
    <div style={{ width: 800, height: 600 }}>
      <Canvas theme="light" modelSelection={modelSelection()} onOpenSettings={vi.fn()} />
    </div>,
  );
  act(() => {
    select(["web"]);
    propose([objectAdd(component("api"))]);
  });
  const before = getAppState().diagram;
  fireEvent.keyDown(document, { key: "ArrowRight" });
  fireEvent.keyDown(document, { key: "x", metaKey: true });
  fireEvent.keyDown(document, { key: "Backspace" });
  expect(getAppState().diagram).toBe(before);
});
