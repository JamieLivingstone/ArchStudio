import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { InlineLabel } from "../InlineLabel";

const edits = vi.hoisted(() => ({ setLabel: vi.fn() }));
vi.mock("../../../state", () => edits);

beforeEach(() => edits.setLabel.mockClear());

function edit(label = "Hello") {
  render(<InlineLabel id="n1" label={label} />);
  fireEvent.doubleClick(screen.getByText(label));
  return screen.getByRole("textbox", { name: "Label" }) as HTMLTextAreaElement;
}

const editor = () => screen.queryByRole("textbox", { name: "Label" });

test("shows the label, or the placeholder when it is empty", () => {
  const { rerender } = render(<InlineLabel id="n1" label="Hello" placeholder="Text" />);
  screen.getByText("Hello");
  expect(editor()).toBeNull();
  rerender(<InlineLabel id="n1" label="" placeholder="Text" />);
  screen.getByText("Text");
});

test("double-click edits with the text focused and selected", () => {
  const textarea = edit();
  expect(document.activeElement).toBe(textarea);
  expect(textarea.value).toBe("Hello");
  expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([0, 5]);
});

test("typing sets the object's name or text", () => {
  fireEvent.change(edit(), { target: { value: "Hello!" } });
  expect(edits.setLabel).toHaveBeenCalledWith("n1", "Hello!");
});

test("Escape, Cmd/Ctrl+Enter and clicking away finish editing", () => {
  fireEvent.keyDown(edit(), { key: "Escape" });
  expect(editor()).toBeNull();

  fireEvent.doubleClick(screen.getByText("Hello"));
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", metaKey: true });
  expect(editor()).toBeNull();

  fireEvent.doubleClick(screen.getByText("Hello"));
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
  expect(editor()).toBeNull();

  fireEvent.doubleClick(screen.getByText("Hello"));
  fireEvent.blur(screen.getByRole("textbox"));
  expect(editor()).toBeNull();
});

test("plain Enter keeps editing, for a new line", () => {
  fireEvent.keyDown(edit(), { key: "Enter" });
  expect(editor()).not.toBeNull();
});

test("sits in the centre unless told to start at the edge", () => {
  const { container, rerender } = render(<InlineLabel id="n1" label="Hello" />);
  expect((container.firstChild as HTMLElement).className).toContain("justify-center");
  rerender(<InlineLabel id="n1" label="Hello" align="start" />);
  expect((container.firstChild as HTMLElement).className).toContain("justify-start");
});
