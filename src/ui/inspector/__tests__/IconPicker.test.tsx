import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Database } from "lucide-react";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { iconChoices, iconFor } from "../../icons";
import { IconPicker } from "../IconPicker";

test("offers the default and every icon choice, marking the current one", () => {
  render(<IconPicker value="Shield" fallback={Database} onChange={() => {}} />);
  expect(screen.getAllByRole("button")).toHaveLength(Object.keys(iconChoices).length + 1);
  expect(button("Shield").getAttribute("aria-pressed")).toBe("true");
  expect(button("Default icon").getAttribute("aria-pressed")).toBe("false");
});

test("choosing an icon, or the default, reports it", async () => {
  const onChange = vi.fn();
  render(<IconPicker value={undefined} fallback={Database} onChange={onChange} />);
  await userEvent.click(button("CreditCard"));
  await userEvent.click(button("Default icon"));
  expect(onChange.mock.calls).toEqual([["CreditCard"], [undefined]]);
});

test("an unknown icon name falls back to the default", () => {
  expect(iconFor("NotAnIcon", Database)).toBe(Database);
  expect(iconFor(undefined, Database)).toBe(Database);
  expect(iconFor("Shield", Database)).toBe(iconChoices.Shield);
});
