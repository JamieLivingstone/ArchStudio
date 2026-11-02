import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider } from "@xyflow/react";
import { expect, test, vi } from "vitest";
import { component, connection, seed, shape } from "../../../test/diagram";
import { button, modelSelection } from "../../../test/dom";
import { select as selectIds } from "../../state";
import { Inspector } from "../Inspector";

function setup() {
  seed([component("lb", "Edge LB"), shape("box", "Box")], [connection("line", "lb", "box")]);
  render(
    <ReactFlowProvider>
      <Inspector modelSelection={modelSelection()} onOpenSettings={vi.fn()} />
    </ReactFlowProvider>,
  );
  const picks = { component: ["lb"], shape: ["box"], line: ["line"], none: [] };
  return {
    user: userEvent.setup(),
    select: async (what: keyof typeof picks) => act(() => selectIds(picks[what])),
  };
}

const isOpen = () => screen.queryByRole("complementary", { name: "Inspector" }) !== null;
const activeTab = () => screen.getByRole("tab", { selected: true }).textContent;

test("starts closed, with a plain button to show it", () => {
  setup();
  expect(isOpen()).toBe(false);
  button("Show panel");
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("has Properties and Assistant tabs", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Properties", "Assistant"]);
});

test("its button first opens it on the assistant, with the composer focused", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  expect(isOpen()).toBe(true);
  expect(activeTab()).toBe("Assistant");
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message" }));
  expect(screen.queryByRole("button", { name: "Show panel" })).toBeNull();
});

test("its button reopens whichever tab was last showing", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  await user.click(screen.getByRole("tab", { name: "Properties" }));
  await user.click(button("Hide panel"));
  await user.click(button("Show panel"));
  expect(activeTab()).toBe("Properties");
});

test("selecting a component opens it on Properties", async () => {
  const { select } = setup();
  await select("component");
  expect(isOpen()).toBe(true);
  expect(activeTab()).toBe("Properties");
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Edge LB");
});

test("it closes again when the selection goes", async () => {
  const { select } = setup();
  await select("component");
  await select("none");
  expect(isOpen()).toBe(false);
});

test("selecting a shape opens it too, and moving between nodes keeps it open", async () => {
  const { select } = setup();
  await select("shape");
  expect(activeTab()).toBe("Properties");
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Box");
  await select("component");
  expect(isOpen()).toBe(true);
  await select("none");
  expect(isOpen()).toBe(false);
});

test("it stays open after deselecting if it has been used meanwhile", async () => {
  const { user, select } = setup();
  await select("component");
  await user.click(screen.getByRole("tab", { name: "Assistant" }));
  await select("none");
  expect(isOpen()).toBe(true);
  expect(activeTab()).toBe("Assistant");
});

test("selecting something during a chat stays on the assistant", async () => {
  const { user, select } = setup();
  await user.click(button("Show panel"));
  await select("component");
  expect(activeTab()).toBe("Assistant");

  await select("none");
  expect(isOpen()).toBe(true);
});

test("the chat's selection chip opens the selection's properties", async () => {
  const { user, select } = setup();
  await user.click(button("Show panel"));
  await select("component");
  await user.click(button("Edge LB"));
  expect(activeTab()).toBe("Properties");
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Edge LB");
});

test("the Properties tab is fainter while nothing is selected", async () => {
  const { user, select } = setup();
  await user.click(button("Show panel"));
  const properties = screen.getByRole("tab", { name: "Properties" });
  expect(properties.className).toContain("text-muted/60");
  await select("component");
  expect(properties.className).not.toContain("text-muted/60");
});

test("an open Properties tab follows the selection", async () => {
  const { select } = setup();
  await select("component");
  await select("shape");
  expect(activeTab()).toBe("Properties");
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Box");
});

test("only the active tab's content is shown", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  expect(screen.getAllByRole("tabpanel").map((panel) => panel.getAttribute("aria-label"))).toEqual(["Assistant"]);
  await user.click(screen.getByRole("tab", { name: "Properties" }));
  expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull();
});

test("closes from its button and on Escape", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  await user.click(button("Hide panel"));
  expect(isOpen()).toBe(false);

  await user.click(button("Show panel"));
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Message" }), { key: "Escape" });
  expect(isOpen()).toBe(false);
});

test("Cmd/Ctrl+J opens the assistant, and closes the panel when the assistant is showing", async () => {
  const { user } = setup();
  fireEvent.keyDown(document, { key: "j", metaKey: true });
  expect(activeTab()).toBe("Assistant");

  await user.click(screen.getByRole("tab", { name: "Properties" }));
  fireEvent.keyDown(document, { key: "J", ctrlKey: true });
  expect(isOpen()).toBe(true);
  expect(activeTab()).toBe("Assistant");

  fireEvent.keyDown(document, { key: "j", metaKey: true });
  expect(isOpen()).toBe(false);
});

test("a conversation survives closing the panel and switching tabs", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  await user.type(screen.getByRole("textbox", { name: "Message" }), "Add a cache{Enter}");
  await user.click(screen.getByRole("tab", { name: "Properties" }));
  await user.click(button("Hide panel"));

  await user.click(button("Show panel"));
  await user.click(screen.getByRole("tab", { name: "Assistant" }));
  expect(screen.getByRole("log", { name: "Conversation" }).textContent).toContain("Add a cache");
});

test("selecting a connection opens it on Properties", async () => {
  const { select } = setup();
  await select("line");
  expect(isOpen()).toBe(true);
  expect(activeTab()).toBe("Properties");
  screen.getByRole("region", { name: "Connection options" });
});

test("Clear chat sits in the header beside the close button, on the Assistant tab only", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  expect(screen.queryByRole("button", { name: "Clear chat" })).toBeNull();

  await user.type(screen.getByRole("textbox", { name: "Message" }), "Add a cache{Enter}");
  const clear = button("Clear chat");
  const header = button("Hide panel").closest("header");
  expect(header?.contains(clear)).toBe(true);

  await user.click(screen.getByRole("tab", { name: "Properties" }));
  expect(screen.queryByRole("button", { name: "Clear chat" })).toBeNull();

  await user.click(screen.getByRole("tab", { name: "Assistant" }));
  await user.click(button("Clear chat"));
  expect(screen.getByRole("log", { name: "Conversation" }).textContent).not.toContain("Add a cache");
});
