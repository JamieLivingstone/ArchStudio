import { fireEvent, render, screen } from "@testing-library/react";
import { Square } from "lucide-react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type DragItem, isAddClick, useDragToAdd } from "../useDragToAdd";

const item: DragItem = {
  node: { type: "rectangle", text: "" },
  title: "Rectangle",
  icon: Square,
};

function Harness({ onDrop }: { onDrop: () => void }) {
  const { beginDrag, ghost } = useDragToAdd(onDrop);
  return (
    <div className="react-flow">
      <div data-testid="canvas" />
      <div className="react-flow__panel">
        <button type="button" onPointerDown={(event) => beginDrag(event, item)}>
          Rectangle
        </button>
        {ghost}
      </div>
    </div>
  );
}

function setup() {
  const onDrop = vi.fn();
  render(<Harness onDrop={onDrop} />);
  const button = screen.getByRole("button", { name: "Rectangle" });
  const pointAt = (element: Element | null) => {
    document.elementFromPoint = () => element;
  };
  pointAt(screen.getByTestId("canvas"));
  return { onDrop, button, pointAt, ghost: () => screen.queryByTestId("drag-ghost") };
}

const original = document.elementFromPoint;
beforeEach(() => {
  document.elementFromPoint = () => null;
});
afterEach(() => {
  document.elementFromPoint = original;
});

test("a press that moves becomes a drag with a label following the pointer", () => {
  const { button, ghost } = setup();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  expect(ghost()).toBeNull();
  fireEvent.pointerMove(document, { clientX: 12, clientY: 12 });
  expect(ghost()).toBeNull();

  fireEvent.pointerMove(document, { clientX: 100, clientY: 80 });
  expect(ghost()?.textContent).toBe("Rectangle");
  expect(ghost()?.style.left).toBe("112px");
  expect(ghost()?.style.top).toBe("92px");
});

test("dropping on the canvas adds the node at that point", () => {
  const { button, onDrop, ghost } = setup();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 300, clientY: 200 });
  fireEvent.pointerUp(document, { clientX: 320, clientY: 210 });
  expect(onDrop).toHaveBeenCalledWith(item.node, { x: 320, y: 210 });
  expect(ghost()).toBeNull();
});

test("a press without movement is not a drag", () => {
  const { button, onDrop } = setup();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(document, { clientX: 11, clientY: 10 });
  expect(onDrop).not.toHaveBeenCalled();
});

test("dropping back on the toolbar, or outside the canvas, adds nothing", () => {
  const { button, onDrop, pointAt, ghost } = setup();
  pointAt(button);
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 40, clientY: 40 });
  fireEvent.pointerUp(document, { clientX: 40, clientY: 40 });

  pointAt(document.body);
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 300, clientY: 200 });
  fireEvent.pointerUp(document, { clientX: 300, clientY: 200 });

  expect(onDrop).not.toHaveBeenCalled();
  expect(ghost()).toBeNull();
});

test("a cancelled drag adds nothing", () => {
  const { button, onDrop, ghost } = setup();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 300, clientY: 200 });
  fireEvent.pointerCancel(document, { clientX: 300, clientY: 200 });
  expect(onDrop).not.toHaveBeenCalled();
  expect(ghost()).toBeNull();
});

test("only the main button starts a drag", () => {
  const { button, onDrop } = setup();
  fireEvent.pointerDown(button, { clientX: 10, clientY: 10, button: 2 });
  fireEvent.pointerMove(document, { clientX: 300, clientY: 200 });
  fireEvent.pointerUp(document, { clientX: 300, clientY: 200 });
  expect(onDrop).not.toHaveBeenCalled();
});

test("a double-click or the keyboard adds; a single click does not", () => {
  const click = (detail: number) => isAddClick({ detail } as MouseEvent);
  expect(click(0)).toBe(true);
  expect(click(1)).toBe(false);
  expect(click(2)).toBe(true);
  expect(click(3)).toBe(false);
});
