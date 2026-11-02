import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { UnsavedDialog } from "../UnsavedDialog";

test("names the file and reports the choice made", async () => {
  const [onSave, onDiscard, onCancel] = [vi.fn(), vi.fn(), vi.fn()];
  render(<UnsavedDialog fileName="orders.json" onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />);
  const user = userEvent.setup();
  expect(screen.getByRole("dialog", { name: "Save changes to orders.json?" })).toBeTruthy();

  await user.click(button("Save"));
  await user.click(button("Discard"));
  await user.click(button("Cancel"));
  fireEvent(screen.getByRole("dialog"), new Event("close"));
  expect([onSave, onDiscard, onCancel].map((each) => each.mock.calls.length)).toEqual([1, 1, 2]);
});
