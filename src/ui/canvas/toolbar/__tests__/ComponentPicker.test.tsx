import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { button } from "../../../../test/dom";
import { ComponentPicker } from "../ComponentPicker";

function setup() {
  const onAdd = vi.fn();
  const onDragStart = vi.fn();
  render(<ComponentPicker onAdd={onAdd} onDragStart={onDragStart} />);
  return { onAdd, onDragStart, search: screen.getByRole("searchbox") };
}

test("lists the catalog with the search focused", () => {
  const { search } = setup();
  expect(document.activeElement).toBe(search);
  screen.getByRole("heading", { name: "Clients" });
  button("Load Balancer");
});

test("a single click adds nothing", async () => {
  const { onAdd } = setup();
  await userEvent.click(button("Web Client"));
  expect(onAdd).not.toHaveBeenCalled();
});

test("a double-click adds the component once", async () => {
  const { onAdd } = setup();
  await userEvent.dblClick(button("Web Client"));
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onAdd).toHaveBeenCalledWith({
    type: "component",
    kind: "webClient",
    name: "Web Client",
    options: {},
  });
});

test("filters by component name, ignoring case", async () => {
  const { search } = setup();
  await userEvent.type(search, "  MOBILE ");
  button("Mobile App");
  expect(screen.queryByRole("button", { name: "Load Balancer" })).toBeNull();
});

test("filters by category name", async () => {
  const { search } = setup();
  await userEvent.type(search, "clients");
  button("Web Client");
  button("Desktop App");
  expect(screen.queryByRole("button", { name: "Load Balancer" })).toBeNull();
});

test("Enter adds the first match", async () => {
  const { search, onAdd } = setup();
  await userEvent.type(search, "load{Enter}");
  expect(onAdd).toHaveBeenCalledWith({
    type: "component",
    kind: "loadBalancer",
    name: "Load Balancer",
    options: {},
  });
});

test("says when nothing matches and adds nothing on Enter", async () => {
  const { search, onAdd } = setup();
  await userEvent.type(search, "zzz{Enter}");
  screen.getByText("No components match.");
  expect(onAdd).not.toHaveBeenCalled();
});

test("the keyboard adds a focused component", () => {
  const { onAdd } = setup();
  fireEvent.click(button("Mobile App"), { detail: 0 });
  expect(onAdd).toHaveBeenCalledWith({
    type: "component",
    kind: "mobileApp",
    name: "Mobile App",
    options: {},
  });
});

test("pressing a component reports it as the start of a possible drag", () => {
  const { onDragStart } = setup();
  fireEvent.pointerDown(button("Load Balancer"));
  expect(onDragStart).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      title: "Load Balancer",
      node: { type: "component", kind: "loadBalancer", name: "Load Balancer", options: {} },
    }),
  );
});
