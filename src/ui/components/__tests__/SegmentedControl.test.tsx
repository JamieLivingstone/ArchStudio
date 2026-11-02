import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRight } from "lucide-react";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { SegmentedControl } from "../SegmentedControl";

const segments = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed", title: "A broken line" },
] as const;

test("marks the chosen segment and reports clicks, including on the chosen one", async () => {
  const onChange = vi.fn();
  render(<SegmentedControl segments={segments} value="solid" onChange={onChange} />);
  expect(button("Solid").getAttribute("aria-pressed")).toBe("true");
  expect(button("Dashed").getAttribute("aria-pressed")).toBe("false");

  await userEvent.click(button("Dashed"));
  await userEvent.click(button("Solid"));
  expect(onChange.mock.calls).toEqual([["dashed"], ["solid"]]);
});

test("can have nothing chosen, drawn as an outline rather than a filled track", () => {
  const { container, rerender } = render(<SegmentedControl segments={segments} value={undefined} onChange={vi.fn()} />);
  const pressed = screen.getAllByRole("button").map((button) => button.getAttribute("aria-pressed"));
  expect(pressed).toEqual(["false", "false"]);
  const track = container.firstElementChild as HTMLElement;
  expect(track.className).toContain("border-dashed");

  rerender(<SegmentedControl segments={segments} value="solid" onChange={vi.fn()} />);
  expect(track.className).not.toContain("border-dashed");
  expect(track.className).toContain("bg-hover");
});

test("an icon-only segment is still named by its label", () => {
  render(
    <SegmentedControl
      segments={[{ value: "forward", label: "Forward", icon: ArrowRight, iconOnly: true }]}
      value="forward"
      onChange={vi.fn()}
    />,
  );
  expect(button("Forward").textContent).toBe("");
  expect(button("Forward").title).toBe("Forward");
});

test("shows hover text and can fill its container", () => {
  const { container } = render(<SegmentedControl segments={segments} value="solid" onChange={vi.fn()} fill />);
  expect(button("Dashed").title).toBe("A broken line");
  expect((container.firstChild as HTMLElement).className).toContain("grid");
});
