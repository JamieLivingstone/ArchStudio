import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { component, connection, diagram, ids, seed, shape, undoLabels } from "../../../test/diagram";
import { button } from "../../../test/dom";
import { getAppState } from "../../state";
import { PropertiesTab } from "../PropertiesTab";

const lb = component("lb", "Edge LB", "loadBalancer", { options: { layer: "Layer 4" } });
const box = shape("box", "Box");
const line = connection("line", "lb", "box", "HTTPS");

function setup(selected: string[]) {
  seed([lb, box], [line], selected);
  render(<PropertiesTab />);
}

test("asks for a selection when there is none", () => {
  setup([]);
  screen.getByText("Select something on the canvas to see its properties.");
  expect(screen.queryByRole("button")).toBeNull();
});

test("shows a component's kind, name and details", () => {
  setup(["lb"]);
  screen.getByRole("heading", { name: "Load Balancer" });
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Edge LB");
  screen.getByRole("region", { name: "Load Balancer details" });
  expect(button("Layer").textContent).toBe("Layer 4");
  expect(button("Algorithm").textContent).toBe("Not set");
});

test("renaming a component changes the diagram and shows the new name", () => {
  setup(["lb"]);
  const name = screen.getByRole("textbox", { name: "Name" });
  fireEvent.change(name, { target: { value: "Public LB" } });
  expect(diagram().objects[0]).toMatchObject({ name: "Public LB" });
  expect(name).toHaveProperty("value", "Public LB");
});

test("changing a detail changes the diagram", async () => {
  setup(["lb"]);
  await userEvent.click(button("Layer"));
  await userEvent.click(screen.getByRole("option", { name: /^Layer 7/ }));
  expect(diagram().objects[0]).toMatchObject({ options: { layer: "Layer 7" } });
  expect(button("Layer").textContent).toBe("Layer 7");
});

test("a description is optional, saved as typed, and one undo step", async () => {
  setup(["lb"]);
  const description = screen.getByRole("textbox", { name: "Description" });
  expect(description).toHaveProperty("value", "");
  await userEvent.type(description, "Spreads traffic");
  expect(diagram().objects[0]).toMatchObject({ description: "Spreads traffic" });
  expect(undoLabels()).toEqual(["Edit description"]);
  await userEvent.clear(description);
  expect(diagram().objects[0]).not.toHaveProperty("description");
});

test("the icon can be changed and set back to the default", async () => {
  setup(["lb"]);
  await userEvent.click(button("Change icon"));
  await userEvent.click(button("Shield"));
  expect(diagram().objects[0]).toMatchObject({ icon: "Shield" });
  expect(button("Shield").getAttribute("aria-pressed")).toBe("true");
  await userEvent.click(button("Default icon"));
  expect(diagram().objects[0]).not.toHaveProperty("icon");
});

test("a rectangle has a name, description, icon and tags, but no details", async () => {
  setup(["box"]);
  screen.getByRole("heading", { name: "Rectangle" });
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Box");
  screen.getByRole("textbox", { name: "Description" });
  button("Change icon");
  expect(screen.queryByRole("region")).toBeNull();
  await userEvent.type(screen.getByRole("textbox", { name: "Add a tag" }), "Stripe{Enter}");
  expect(diagram().objects[1]).toMatchObject({ tags: ["Stripe"] });
});

test("editing a shape's name changes the diagram", () => {
  setup(["box"]);
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Zone A" } });
  expect(diagram().objects[1]).toMatchObject({ text: "Zone A" });
});

test("text has only its words", () => {
  seed([shape("note", "Hello", "text")], [], ["note"]);
  render(<PropertiesTab />);
  expect(screen.getByRole("textbox", { name: "Text" })).toHaveProperty("value", "Hello");
  expect(screen.queryByRole("textbox", { name: "Description" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Change icon" })).toBeNull();
});

test("Delete removes the selected object and its connections", async () => {
  setup(["lb"]);
  await userEvent.click(button("Delete"));
  expect(ids()).toEqual(["box"]);
  expect(diagram().connections).toEqual([]);
  screen.getByText("Select something on the canvas to see its properties.");
});

test("with several objects selected it only offers to delete them all", async () => {
  setup(["lb", "box"]);
  screen.getByRole("heading", { name: "2 nodes selected" });
  expect(screen.queryByRole("textbox")).toBeNull();
  await userEvent.click(button("Delete 2 nodes"));
  expect(ids()).toEqual([]);
  expect(undoLabels()).toEqual(["Delete"]);
});

test("a connection has its label, arrowheads and line style", () => {
  setup(["line"]);
  screen.getByRole("heading", { name: "Connection" });
  expect(screen.getByRole("textbox", { name: "Label" })).toHaveProperty("value", "HTTPS");
  screen.getByRole("region", { name: "Connection options" });
  expect(button("Solid").getAttribute("aria-pressed")).toBe("true");
});

test("editing a connection changes the diagram", async () => {
  setup(["line"]);
  fireEvent.change(screen.getByRole("textbox", { name: "Label" }), { target: { value: "gRPC" } });
  await userEvent.click(button("Dashed"));
  expect(diagram().connections[0]).toMatchObject({ label: "gRPC", line: "dashed" });
  expect(button("Dashed").getAttribute("aria-pressed")).toBe("true");
});

test("Delete removes the selected connection and leaves its objects", async () => {
  setup(["line"]);
  await userEvent.click(button("Delete"));
  expect(diagram().connections).toEqual([]);
  expect(ids()).toEqual(["lb", "box"]);
});

test("a mixed selection is counted as items and deleted together", async () => {
  setup(["lb", "box", "line"]);
  screen.getByRole("heading", { name: "3 items selected" });
  await userEvent.click(button("Delete 3 items"));
  expect(ids()).toEqual([]);
});

test("several connections are counted as connections", () => {
  seed([lb, box, shape("c")], [line, connection("line2", "box", "c")], ["line", "line2"]);
  render(<PropertiesTab />);
  screen.getByRole("heading", { name: "2 connections selected" });
});

test("adds and removes a component's tags", async () => {
  setup(["lb"]);
  const field = screen.getByRole("textbox", { name: "Add a tag" });
  await userEvent.type(field, "edge{Enter}EU only,");
  expect(diagram().objects[0]).toMatchObject({ tags: ["edge", "EU only"] });

  await userEvent.click(button("Remove edge"));
  expect(diagram().objects[0]).toMatchObject({ tags: ["EU only"] });
});

test("a boundary has a name, an optional kind, a description and tags, and deleting it keeps its contents", async () => {
  seed(
    [
      { type: "boundary", id: "g", position: { x: 0, y: 0 }, size: { width: 400, height: 300 }, name: "Payments" },
      { ...lb, parent: "g" },
    ],
    [],
    ["g"],
  );
  render(<PropertiesTab />);
  screen.getByRole("heading", { name: "Boundary" });
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "Payments");
  await userEvent.click(button("Kind"));
  await userEvent.click(screen.getByRole("option", { name: /^Team/ }));
  expect(diagram().objects[0]).toMatchObject({ kind: "team" });
  screen.getByRole("heading", { name: "Team" });

  await userEvent.click(button("Clear Kind"));
  expect(diagram().objects[0]).not.toHaveProperty("kind");

  await userEvent.click(button("Delete boundary, keep contents"));
  expect(diagram().objects.map((object) => object.id)).toEqual(["lb"]);
});

test("something inside boundaries shows where it is, each boundary can be selected, and it can be moved out", async () => {
  seed(
    [
      {
        type: "boundary",
        id: "team",
        position: { x: 0, y: 0 },
        size: { width: 800, height: 600 },
        name: "Checkout",
        kind: "team",
      },
      {
        type: "boundary",
        id: "svc",
        position: { x: 24, y: 48 },
        size: { width: 400, height: 300 },
        name: "",
        kind: "service",
        parent: "team",
      },
      { ...lb, position: { x: 48, y: 96 }, parent: "svc" },
    ],
    [],
    ["lb"],
  );
  render(<PropertiesTab />);
  const inside = screen.getByRole("navigation", { name: "Inside" });
  expect(inside.textContent).toBe("InCheckoutUnnamed serviceMove out");
  await userEvent.click(button("Move out"));
  expect(diagram().objects[2]).toMatchObject({ parent: "team", position: { x: 24 + 400 + 40, y: 96 } });
  await userEvent.click(button("Checkout"));
  expect(getAppState().selection).toEqual(["team"]);
});

test("with several things selected, they can be put in a boundary of a chosen kind", async () => {
  setup(["lb", "box"]);
  await userEvent.click(button("Service"));
  const boundary = diagram().objects.find((object) => object.type === "boundary");
  expect(boundary).toMatchObject({ kind: "service" });
  expect(
    diagram()
      .objects.filter((object) => object.parent === boundary?.id)
      .map((object) => object.id),
  ).toEqual(["lb", "box"]);
});
