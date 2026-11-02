import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { shape } from "../../test/diagram";
import { button } from "../../test/dom";
import { Header } from "../Header";
import { addObject, getAppState, markSaved } from "../state";

function setup(error = "") {
  const onSave = vi.fn();
  const onHome = vi.fn();
  render(<Header error={error} onError={vi.fn()} onSave={onSave} onHome={onHome} />);
  return { onSave, onHome, user: userEvent.setup() };
}

test("names the file and marks unsaved changes", () => {
  setup();
  expect(screen.getByText("Untitled")).toBeTruthy();

  act(() => addObject(shape("note", "Note", "text"), "Add text"));
  expect(screen.getByText("Untitled · Edited")).toBeTruthy();

  act(() => markSaved(getAppState().diagram, { name: "orders.json" }));
  expect(screen.getByText("orders.json")).toBeTruthy();
});

test("a save error replaces the file name", () => {
  setup("Could not save. Disk full");
  expect(screen.getByRole("alert").textContent).toBe("Could not save. Disk full");
  expect(screen.queryByText("Untitled")).toBeNull();
});

test("Home and Save call back", async () => {
  const { onSave, onHome, user } = setup();
  await user.click(button("Home"));
  expect(onHome).toHaveBeenCalledTimes(1);

  await user.click(button("Save"));
  expect(onSave).toHaveBeenCalledTimes(1);
});
