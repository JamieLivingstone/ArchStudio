import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Tooltip } from "../Tooltip";

test("shows its title and description", () => {
  render(<Tooltip title="Undo" description="Cmd/Ctrl+Z" side="top" />);
  expect(screen.getByRole("tooltip").textContent).toBe("UndoCmd/Ctrl+Z");
});

test("the description is optional", () => {
  render(<Tooltip title="Undo" side="top" />);
  expect(screen.getByRole("tooltip").textContent).toBe("Undo");
});

test("sits on the chosen side of its control", () => {
  const { rerender } = render(<Tooltip title="Undo" side="left" />);
  expect(screen.getByRole("tooltip").className).toContain("right-full");
  rerender(<Tooltip title="Undo" side="right" />);
  expect(screen.getByRole("tooltip").className).toContain("left-full");
  rerender(<Tooltip title="Undo" side="top" />);
  expect(screen.getByRole("tooltip").className).toContain("bottom-full");
});
