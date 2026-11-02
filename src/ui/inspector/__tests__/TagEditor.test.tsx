import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { TagEditor } from "../TagEditor";

function setup(tags: string[] = []) {
  const onChange = vi.fn();
  render(<TagEditor tags={tags} onChange={onChange} />);
  return { onChange, field: screen.getByRole("textbox", { name: "Add a tag" }) as HTMLInputElement };
}

test("shows each tag as a removable pill", async () => {
  const { onChange } = setup(["edge", "EU only"]);
  screen.getByText("edge");
  await userEvent.click(button("Remove EU only"));
  expect(onChange).toHaveBeenCalledWith(["edge"]);
});

test("Enter, a comma or leaving the field adds the typed tag, trimmed", async () => {
  const { onChange, field } = setup(["edge"]);
  await userEvent.type(field, "  read heavy {Enter}");
  expect(onChange).toHaveBeenLastCalledWith(["edge", "read heavy"]);
  expect(field.value).toBe("");

  await userEvent.type(field, "eu,");
  expect(onChange).toHaveBeenLastCalledWith(["edge", "eu"]);

  await userEvent.type(field, "cold");
  field.blur();
  expect(onChange).toHaveBeenLastCalledWith(["edge", "cold"]);
});

test("ignores an empty or repeated tag", async () => {
  const { onChange, field } = setup(["edge"]);
  await userEvent.type(field, "   {Enter}edge{Enter}");
  expect(onChange).not.toHaveBeenCalled();
});

test("Backspace in an empty field removes the last tag", async () => {
  const { onChange, field } = setup(["edge", "eu"]);
  await userEvent.type(field, "{Backspace}");
  expect(onChange).toHaveBeenCalledWith(["edge"]);
});

test("the placeholder only shows while there are no tags", () => {
  expect(setup().field.placeholder).toBe("Add a tag");
});
