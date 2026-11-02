import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { BaseNode } from "../BaseNode";

vi.mock("@xyflow/react", () => ({
  Handle: ({ id }: { id: string }) => <div data-testid="handle" data-side={id} />,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  NodeResizer: ({ isVisible }: { isVisible: boolean }) => (isVisible ? <div data-testid="resizer" /> : null),
}));

test("renders its content with a handle on each side", () => {
  render(<BaseNode selected={false}>Content</BaseNode>);
  screen.getByText("Content");
  const handles = screen.getAllByTestId("handle").map((handle) => handle.dataset.side);
  expect(handles).toEqual(["top", "right", "bottom", "left"]);
});

test("has no handles when it is not connectable", () => {
  render(
    <BaseNode selected={false} connectable={false}>
      Content
    </BaseNode>,
  );
  expect(screen.queryAllByTestId("handle")).toEqual([]);
});

test("outlines the node only while selected", () => {
  const { rerender } = render(
    <BaseNode selected={false} className="shape">
      Content
    </BaseNode>,
  );
  expect(screen.getByText("Content").className).not.toContain("outline");
  rerender(
    <BaseNode selected className="shape">
      Content
    </BaseNode>,
  );
  expect(screen.getByText("Content").className).toContain("outline-accent");
});

test("has no popover of its own, even while selected", () => {
  render(<BaseNode selected>Content</BaseNode>);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("shows resize handles only while selected, and only if resizable", () => {
  const box = { minWidth: 10, minHeight: 10 };
  const { rerender } = render(
    <BaseNode selected resizable={box}>
      Content
    </BaseNode>,
  );
  screen.getByTestId("resizer");
  rerender(
    <BaseNode selected={false} resizable={box}>
      Content
    </BaseNode>,
  );
  expect(screen.queryByTestId("resizer")).toBeNull();
  rerender(<BaseNode selected>Content</BaseNode>);
  expect(screen.queryByTestId("resizer")).toBeNull();
});
