import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { type ComponentKind, getKindDefinition, type OptionValue } from "../../../diagram/componentKinds";
import { type DatabaseStructure, dataModels, structureLabels } from "../../../diagram/databaseStructure";
import { component, diagram, seed, undoLabels } from "../../../test/diagram";
import { button } from "../../../test/dom";
import { useAppState } from "../../state";
import { ComponentDetails } from "../ComponentDetails";

type Component = { options: Record<string, OptionValue>; structure?: DatabaseStructure };
const saved = () => diagram().objects[0] as unknown as Component;

function Live() {
  const object = useAppState((state) => state.diagram.objects[0]) as unknown as Component & { kind: ComponentKind };
  return <ComponentDetails id="n1" kind={object.kind} options={object.options} structure={object.structure} />;
}

function setup(kind: ComponentKind, options: Record<string, OptionValue> = {}, structure?: DatabaseStructure) {
  seed([component("n1", "Node", kind, { options, ...(structure ? { structure } : {}) })]);
  render(<Live />);
}

const choiceTitled = (title: string) => {
  const found = screen.getAllByRole("option").find((element) => element.firstElementChild?.textContent === title);
  if (!found) throw new Error(`No choice titled "${title}"`);
  return found;
};
const choose = async (label: string, value: string) => {
  await userEvent.click(screen.getByRole("button", { name: label }));
  await userEvent.click(choiceTitled(value));
};
const rows = () => screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"));

test("every detail that applies is listed, unset, with nothing saved", () => {
  setup("loadBalancer");
  expect(rows()).toEqual(getKindDefinition("loadBalancer").options.map((option) => option.label));
  expect(button("Layer").textContent).toBe("Not set");
  expect(saved().options).toEqual({});
});

test("choosing a value saves it and shows it", async () => {
  setup("loadBalancer");
  await choose("Algorithm", "Least connections");
  expect(saved().options).toEqual({ algorithm: "Least connections" });
  expect(button("Algorithm").textContent).toBe("Least connections");
});

test("only set details can be cleared, and clearing unsets them", async () => {
  setup("loadBalancer", { layer: "Layer 4", sticky: true });
  expect(screen.queryByRole("button", { name: "Clear Algorithm" })).toBeNull();
  await userEvent.click(button("Clear Layer"));
  expect(saved().options).toEqual({ sticky: true });
  expect(button("Layer").textContent).toBe("Not set");
});

test("a switch can be set to On or Off, and Off is kept apart from unset", async () => {
  setup("loadBalancer");
  const group = within(screen.getByRole("group", { name: "Health checks" }));
  const [on, off] = [group.getByRole("button", { name: "On" }), group.getByRole("button", { name: "Off" })];
  expect([on.getAttribute("aria-pressed"), off.getAttribute("aria-pressed")]).toEqual(["false", "false"]);
  await userEvent.click(off);
  expect(saved().options).toEqual({ healthChecks: false });
  expect(off.getAttribute("aria-pressed")).toBe("true");
});

test("a number is saved once it is a valid whole number, as one undo step", async () => {
  setup("service");
  const field = screen.getByRole("textbox", { name: "Instances" });
  await userEvent.type(field, "12");
  expect(saved().options).toEqual({ instances: 12 });
  expect(undoLabels()).toEqual(["Change details"]);
  await userEvent.type(field, "x");
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(saved().options).toEqual({ instances: 12 });
});

test("a duration is saved only in a form like 15m", async () => {
  setup("cache");
  const field = screen.getByRole("textbox", { name: "TTL" });
  await userEvent.type(field, "15");
  expect(saved().options).toEqual({});
  await userEvent.type(field, "m");
  expect(saved().options).toEqual({ ttl: "15m" });
});

test("a number can be Auto where that makes sense", async () => {
  setup("streamProcessor");
  await userEvent.type(screen.getByRole("textbox", { name: "Parallelism" }), "auto");
  expect(saved().options).toEqual({ parallelism: "Auto" });
});

test("a dependent detail is listed only once its parent allows it", async () => {
  setup("database");
  expect(rows()).not.toContain("Replicas");
  await choose("Replication", "Primary-replica");
  expect(rows()).toContain("Replicas");
  await userEvent.type(screen.getByRole("textbox", { name: "Replicas" }), "2");
  expect(saved().options).toEqual({ replication: "Primary-replica", replicaCount: 2 });

  await choose("Replication", "None");
  expect(saved().options).toEqual({ replication: "None" });
  expect(rows()).not.toContain("Replicas");
});

test("a database shows the structure for its data model, and no other", () => {
  setup("database");
  const structureRows = () => rows().filter((row) => Object.values(structureLabels).includes(row ?? ""));
  expect(structureRows()).toEqual([]);
  for (const model of dataModels) {
    act(() => seed([component("n1", "Node", "database", { options: { model } })]));
    expect(structureRows()).toEqual([structureLabels[model]]);
  }
});

test("relational tables are saved as they are typed, and only once something is added", async () => {
  setup("database", { model: "Relational" });
  expect(saved()).not.toHaveProperty("structure");
  await userEvent.click(button("Add table"));
  await userEvent.keyboard("orders");
  await userEvent.click(button("Add column"));
  await userEvent.keyboard("id");
  await userEvent.type(screen.getByRole("textbox", { name: "Type" }), "uuid");
  await userEvent.click(button("Primary key"));
  expect(saved().structure).toEqual({
    model: "Relational",
    tables: [{ name: "orders", columns: [{ name: "id", type: "uuid", primaryKey: true }] }],
  });
});

test("a key-value database describes its key patterns", async () => {
  setup("database", { model: "Key-value" });
  await userEvent.click(button("Add key pattern"));
  await userEvent.type(screen.getByRole("textbox", { name: "Key" }), "session:{{id}");
  await userEvent.type(screen.getByRole("textbox", { name: "TTL" }), "30m");
  expect(saved().structure).toEqual({ model: "Key-value", patterns: [{ key: "session:{id}", ttl: "30m" }] });
});

test.each<[string, string, DatabaseStructure]>([
  ["Document", "Add collection", { model: "Document", collections: [{ name: "users", fields: [] }] }],
  ["Wide-column", "Add table", { model: "Wide-column", tables: [{ name: "users", partitionKey: "", columns: [] }] }],
  ["Time-series", "Add series", { model: "Time-series", series: [{ name: "users", dimensions: [], values: [] }] }],
  ["Vector", "Add collection", { model: "Vector", collections: [{ name: "users", metadata: [], filterable: [] }] }],
])("a %s database starts each new item with only what it must have", async (model, add, structure) => {
  setup("database", { model });
  await userEvent.click(screen.getByRole("button", { name: add }));
  await userEvent.keyboard("users");
  expect(saved().structure).toEqual(structure);
});

test("a list of names and optional text are saved on an item", async () => {
  setup("database", { model: "Document" });
  await userEvent.click(button("Add collection"));
  await userEvent.keyboard("users");
  await userEvent.type(screen.getByRole("textbox", { name: "Add a field" }), "email{Enter}");
  await userEvent.type(screen.getByRole("textbox", { name: "Document ID" }), "_id");
  expect(saved().structure).toEqual({
    model: "Document",
    collections: [{ name: "users", id: "_id", fields: ["email"] }],
  });

  await userEvent.clear(screen.getByRole("textbox", { name: "Document ID" }));
  expect(saved().structure).toEqual({ model: "Document", collections: [{ name: "users", fields: ["email"] }] });
});

test("a graph database lists node types and relationships", async () => {
  setup("database", { model: "Graph" });
  await userEvent.type(screen.getByRole("textbox", { name: "Add a node type" }), "User{Enter}");
  await userEvent.click(button("Add relationship"));
  await userEvent.type(screen.getByRole("textbox", { name: "Relationship" }), "FOLLOWS");
  expect(saved().structure).toEqual({ model: "Graph", nodeTypes: ["User"], relationships: [{ name: "FOLLOWS" }] });
});

const tables: DatabaseStructure = {
  model: "Relational",
  tables: [
    { name: "orders", columns: [{ name: "id" }] },
    { name: "customers", columns: [] },
  ],
};

test("switching data model asks before removing the structure, and Keep leaves everything as it was", async () => {
  setup("database", { model: "Relational" }, tables);
  await choose("Data model", "Key-value");
  expect(screen.getByRole("alert").textContent).toContain(
    "Switching to Key-value removes the tables defined for Relational (2 tables)",
  );
  expect(saved()).toMatchObject({ options: { model: "Relational" }, structure: tables });

  await userEvent.click(button("Keep Relational"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(saved()).toMatchObject({ options: { model: "Relational" }, structure: tables });
});

test("confirming the switch changes the model and removes the structure as one undo step", async () => {
  setup("database", { model: "Relational" }, tables);
  await choose("Data model", "Key-value");
  await userEvent.click(button("Switch"));
  expect(saved().options).toEqual({ model: "Key-value" });
  expect(saved()).not.toHaveProperty("structure");
  expect(undoLabels()).toEqual(["Change details"]);
});

test("clearing the data model also asks first", async () => {
  setup("database", { model: "Relational" }, tables);
  await userEvent.click(button("Clear Data model"));
  expect(screen.getByRole("alert").textContent).toContain("Clearing the data model removes the tables");
  await userEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Clear" }));
  expect(saved()).toMatchObject({ options: {} });
  expect(saved()).not.toHaveProperty("structure");
});

test("each choice explains itself in the list", async () => {
  setup("cdn");
  await userEvent.click(button("Distribution model"));
  expect(choiceTitled("Pull").textContent).toContain("Content is fetched from the origin when first requested.");
});

test("the choice list closes on Escape without choosing", async () => {
  setup("loadBalancer", { layer: "Layer 4" });
  await userEvent.click(button("Layer"));
  screen.getByRole("listbox", { name: "Layer" });
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(saved().options).toEqual({ layer: "Layer 4" });
});

test("a kind without details shows nothing", () => {
  setup("cli");
  expect(screen.queryByRole("region")).toBeNull();
});

test("emptying a typed detail unsets it, rather than leaving the old value behind what looks empty", async () => {
  setup("service", { instances: 3, state: "Stateless" });
  const field = screen.getByRole("textbox", { name: "Instances" });
  await userEvent.clear(field);
  expect(saved().options).toEqual({ state: "Stateless" });
  await userEvent.type(field, "x");
  expect(saved().options).toEqual({ state: "Stateless" });
});
