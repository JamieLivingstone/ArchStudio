import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Dialog } from "../Dialog";

function setup(open?: boolean) {
  const onClose = vi.fn();
  const dialog = (
    <Dialog open={open} onClose={onClose} labelledBy="title">
      <h2 id="title">Hello</h2>
    </Dialog>
  );
  const { container, rerender } = render(dialog);
  return { onClose, element: container.querySelector("dialog") as HTMLDialogElement, rerender };
}

test("is open unless told otherwise, and named by its title", () => {
  const { element } = setup();
  expect(element.open).toBe(true);
  expect(screen.getByRole("dialog", { name: "Hello" })).toBe(element);
});

test("takes focus itself rather than its first control", () => {
  render(
    <Dialog onClose={() => {}} labelledBy="title">
      <h2 id="title">Hello</h2>
      <button type="button">First</button>
    </Dialog>,
  );
  expect(document.activeElement).toBe(screen.getByRole("dialog"));
});

test("follows `open`", () => {
  const { element, rerender, onClose } = setup(false);
  expect(element.open).toBe(false);
  rerender(
    <Dialog open onClose={onClose} labelledBy="title">
      <h2 id="title">Hello</h2>
    </Dialog>,
  );
  expect(element.open).toBe(true);
});

test("closes on Escape or a click on the backdrop, but not on a click inside", () => {
  const { element, onClose } = setup();
  fireEvent.click(screen.getByText("Hello"));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(element);
  fireEvent(element, new Event("close"));
  expect(onClose).toHaveBeenCalledTimes(2);
});
