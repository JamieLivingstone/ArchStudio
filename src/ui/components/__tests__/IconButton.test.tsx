import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Undo2 } from "lucide-react";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { IconButton } from "../IconButton";

test("is named by its label and passes clicks through", async () => {
  const onClick = vi.fn();
  render(<IconButton label="Undo" icon={Undo2} onClick={onClick} />);
  await userEvent.click(button("Undo"));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("has a tooltip when given a side for it", () => {
  render(<IconButton label="Undo" description="Cmd/Ctrl+Z" icon={Undo2} tooltip="top" />);
  expect(screen.getByRole("tooltip").textContent).toBe("UndoCmd/Ctrl+Z");
});

test("can be disabled, active and given other button attributes", () => {
  const { rerender } = render(<IconButton label="Undo" icon={Undo2} disabled />);
  expect(screen.getByRole("button")).toHaveProperty("disabled", true);
  rerender(<IconButton label="Undo" icon={Undo2} active aria-pressed />);
  expect(screen.getByRole("button").className).toContain("bg-hover text-fg");
  expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
});

test("renders anything anchored to it", () => {
  render(
    <IconButton label="Components" icon={Undo2}>
      <p>Flyout</p>
    </IconButton>,
  );
  screen.getByText("Flyout");
});
