import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { expect, test, vi } from "vitest";
import { component, connection, diagram, seed, shape, undoLabels } from "../../../../test/diagram";
import { button } from "../../../../test/dom";
import { addObject } from "../../../state";
import { layout } from "../../layout/format";
import { HistoryControls } from "../HistoryControls";

vi.mock("../../layout/format", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../layout/format")>();
  return { ...original, layout: vi.fn(original.layout) };
});

function setup() {
  render(
    <ReactFlowProvider>
      <HistoryControls />
      <input aria-label="Name" />
    </ReactFlowProvider>,
  );
}

const count = () => diagram().objects.length;
const tooltips = () => screen.getAllByRole("tooltip").map((tooltip) => tooltip.textContent);

test("both buttons are disabled when there is nothing to undo or redo", () => {
  setup();
  expect(button("Undo").disabled).toBe(true);
  expect(button("Redo").disabled).toBe(true);
  expect(tooltips()).toEqual([
    "UndoCmd/Ctrl+Z",
    "RedoShift+Cmd/Ctrl+Z",
    "FormatArrange everything neatly (Shift+Alt+F)",
  ]);
  expect(button("Format").disabled).toBe(true);
});

test("the buttons undo and redo, and say what they would act on", async () => {
  setup();
  addObject(component("lb"), "Add load balancer");
  await screen.findByText("Add load balancer (Cmd/Ctrl+Z)");
  expect(button("Redo").disabled).toBe(true);

  await userEvent.click(button("Undo"));
  expect(count()).toBe(0);
  expect(button("Undo").disabled).toBe(true);
  expect(tooltips()[1]).toBe("RedoAdd load balancer (Shift+Cmd/Ctrl+Z)");

  await userEvent.click(button("Redo"));
  expect(count()).toBe(1);
});

test("Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z redoes", () => {
  setup();
  addObject(component("lb"), "Add load balancer");
  fireEvent.keyDown(document, { key: "z", metaKey: true });
  expect(count()).toBe(0);
  fireEvent.keyDown(document, { key: "Z", ctrlKey: true, shiftKey: true });
  expect(count()).toBe(1);
  fireEvent.keyDown(document, { key: "z", ctrlKey: true });
  expect(count()).toBe(0);
});

test("ignores other keys and leaves text fields their own undo", () => {
  setup();
  addObject(component("lb"), "Add load balancer");
  fireEvent.keyDown(document, { key: "z" });
  fireEvent.keyDown(document, { key: "y", metaKey: true });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "z", metaKey: true });
  expect(count()).toBe(1);
});

function scattered() {
  seed(
    [
      component("web", "Web", "webClient", { position: { x: 700, y: 400 } }),
      component("api", "API", "service", { position: { x: 100, y: 900 } }),
      component("db", "DB", "database", { position: { x: 400, y: 100 } }),
    ],
    [connection("c1", "web", "api"), connection("c2", "api", "db")],
  );
}
const at = (id: string) => diagram().objects.find((object) => object.id === id)?.position ?? { x: 0, y: 0 };

test("Format arranges connected components left to right, level, as one undo step", async () => {
  scattered();
  setup();
  await userEvent.click(button("Format"));
  await waitFor(() => expect(undoLabels()).toEqual(["Format layout"]));
  expect(at("web").x).toBeLessThan(at("api").x);
  expect(at("api").x).toBeLessThan(at("db").x);
  expect(new Set(["web", "api", "db"].map((id) => at(id).y)).size).toBe(1);
  expect(Math.min(...["web", "api", "db"].map((id) => at(id).x))).toBe(100);

  await userEvent.click(button("Undo"));
  expect(at("web")).toEqual({ x: 700, y: 400 });
});

test("Shift+Alt+F formats too, but not while typing", async () => {
  scattered();
  setup();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), {
    key: "Ï",
    code: "KeyF",
    shiftKey: true,
    altKey: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(undoLabels()).toEqual([]);
  fireEvent.keyDown(document, { key: "Ï", code: "KeyF", shiftKey: true, altKey: true });
  await waitFor(() => expect(undoLabels()).toEqual(["Format layout"]));
});

test("pressing Format again while it is still arranging does nothing more", async () => {
  scattered();
  setup();
  vi.mocked(layout).mockClear();
  fireEvent.keyDown(document, { key: "Ï", code: "KeyF", shiftKey: true, altKey: true });
  fireEvent.keyDown(document, { key: "Ï", code: "KeyF", shiftKey: true, altKey: true });
  await waitFor(() => expect(undoLabels()).toEqual(["Format layout"]));
  expect(layout).toHaveBeenCalledTimes(1);
});

test("Format leaves free text where it was, and with only text there is nothing to format", async () => {
  const note = { ...shape("note", "Remember to add auth", "text"), position: { x: -500, y: -300 } };
  seed(
    [
      component("web", "Web", "webClient", { position: { x: 700, y: 400 } }),
      component("api", "API", "service", { position: { x: 100, y: 900 } }),
      note,
    ],
    [connection("c1", "web", "api")],
  );
  setup();
  await userEvent.click(button("Format"));
  await waitFor(() => expect(undoLabels()).toEqual(["Format layout"]));
  expect(at("note")).toEqual({ x: -500, y: -300 });
  expect(Math.min(at("web").x, at("api").x)).toBe(100);
});

test("Format is unavailable when there is only text", () => {
  seed([shape("note", "Hi", "text")]);
  setup();
  expect(button("Format").disabled).toBe(true);
});

test("a layout that finishes after another diagram was loaded is not applied to it", async () => {
  scattered();
  setup();
  let finish = () => {};
  const started = new Promise<void>((begun) => {
    vi.mocked(layout).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ positions: new Map([["api", { x: 42, y: 42 }]]), sizes: new Map() });
          begun();
        }),
    );
  });
  fireEvent.keyDown(document, { key: "Ï", code: "KeyF", shiftKey: true, altKey: true });
  await started;

  seed([component("api", "API", "service", { position: { x: 1000, y: 1000 } })]);
  finish();
  await waitFor(() => {
    fireEvent.keyDown(document, { key: "Ï", code: "KeyF", shiftKey: true, altKey: true });
    expect(layout).toHaveBeenCalledTimes(2);
  });
  expect(undoLabels()).not.toContain("Format layout");
});
