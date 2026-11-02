import { afterEach, expect, test, vi } from "vitest";
import { parseDiagram, serializeDiagram } from "../../diagram/parse";
import {
  boundary,
  component,
  connection,
  connectionAdd,
  connectionRemove,
  diagram,
  diagramOf,
  ids,
  objectAdd,
  objectRemove,
  objectUpdate,
  seed,
  selection,
  shape,
  undoLabels,
} from "../../test/diagram";
import { type Proposal, proposalRows } from "../proposal";
import {
  acceptProposal,
  addObject,
  arrangeProposal,
  canConnect,
  change,
  connect,
  endEdit,
  fitBoundariesToContents,
  formatLayout,
  getAppState,
  groupObjects,
  hasUnsavedChanges,
  insertionTarget,
  loadDiagram,
  makeRoomFor,
  markSaved,
  moveObjects,
  moveOutOfBoundary,
  nudgeSelected,
  pendingProposal,
  propose,
  redo,
  rejectProposal,
  remove,
  removeSelected,
  resizeObject,
  select,
  selectAll,
  selectedConnections,
  selectedObjects,
  selectionInScope,
  setConnectionLabel,
  setConnectionStyle,
  setDescription,
  setLabel,
  setOptions,
  setTags,
  startFromArranged,
  undo,
} from "../state";

afterEach(() => vi.restoreAllMocks());

const start = () =>
  seed(
    [component("lb", "LB"), component("web", "Web", "webClient"), shape("box", "Zone"), shape("note", "Hi", "text")],
    [connection("web-lb", "web", "lb")],
  );
const pending = () => pendingProposal(getAppState());
const lineIds = () => diagram().connections.map(({ id }) => id);

test("starts with an empty diagram, nothing selected and nothing to undo", () => {
  expect(diagram()).toEqual(diagramOf([]));
  expect(selection()).toEqual([]);
  expect(undoLabels()).toEqual([]);
});

test("a change is applied as one named step", () => {
  const done = change("Add two", [objectAdd(component("lb")), objectAdd(component("web"))]);
  expect(done).toBe(true);
  expect(ids()).toEqual(["lb", "web"]);
  expect(undoLabels()).toEqual(["Add two"]);
});

test("a change that breaks the rules is refused whole, and reported", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  start();
  const done = change("Add", [objectAdd(component("new")), objectAdd(component("lb"))]);
  expect(done).toBe(false);
  expect(ids()).toHaveLength(4);
  expect(undoLabels()).toEqual([]);
  expect(logged).toHaveBeenCalled();
});

test("a change with no operations adds no step", () => {
  start();
  expect(change("Nothing", [])).toBe(false);
  moveObjects([]);
  remove(["gone"]);
  expect(undoLabels()).toEqual([]);
});

test("the diagram is replaced, never changed in place", () => {
  start();
  const before = diagram();
  const copy = structuredClone(before);
  setLabel("lb", "Edge");
  expect(before).toEqual(copy);
  expect(diagram()).not.toBe(before);
});

test("undo and redo step back and forth", () => {
  addObject(component("lb"), "Add LB");
  addObject(component("web"), "Add Web");

  undo();
  expect(ids()).toEqual(["lb"]);
  undo();
  undo();
  expect(ids()).toEqual([]);

  redo();
  redo();
  redo();
  expect(ids()).toEqual(["lb", "web"]);
  expect(undoLabels()).toEqual(["Add LB", "Add Web"]);
});

test("a new change discards what could be redone", () => {
  addObject(component("lb"), "Add LB");
  undo();
  addObject(component("web"), "Add Web");
  expect(getAppState().redoSteps).toEqual([]);
});

test("typing in one place is a single undo step", () => {
  start();
  setLabel("lb", "E");
  setLabel("lb", "Ed");
  setLabel("lb", "Edge");
  expect(undoLabels()).toEqual(["Rename"]);

  undo();
  expect(diagram().objects[0]).toMatchObject({ name: "LB" });
  redo();
  expect(diagram().objects[0]).toMatchObject({ name: "Edge" });
});

test("typing somewhere else, or after another change, starts a new step", () => {
  start();
  setLabel("lb", "A");
  setLabel("box", "Zone A");
  setLabel("lb", "B");
  setOptions("lb", { sticky: true });
  setLabel("lb", "C");
  expect(undoLabels()).toEqual(["Rename", "Edit text", "Rename", "Change details", "Rename"]);
});

test("typing after an undo and redo does not merge into the redone step", () => {
  start();
  setLabel("lb", "A");
  undo();
  redo();
  setLabel("lb", "B");
  undo();
  expect(diagram().objects[0]).toMatchObject({ name: "A" });
});

test("the selection is not part of the history", () => {
  start();
  select(["lb"]);
  expect(undoLabels()).toEqual([]);
  setLabel("lb", "Edge");
  undo();
  expect(selection()).toEqual(["lb"]);
});

test("selected objects and connections leave out ids that no longer exist", () => {
  start();
  select(["lb", "web-lb", "gone"]);
  expect(selectedObjects(getAppState()).map((object) => object.id)).toEqual(["lb"]);
  expect(selectedConnections(getAppState()).map((line) => line.id)).toEqual(["web-lb"]);
});

test("select all selects every object, not connections", () => {
  start();
  selectAll();
  expect(selection()).toEqual(["lb", "web", "box", "note"]);
});

test("loading a diagram clears the selection and the history", () => {
  start();
  select(["lb"]);
  setLabel("lb", "Edge");
  loadDiagram(diagramOf([component("only")]));
  expect(ids()).toEqual(["only"]);
  expect(selection()).toEqual([]);
  expect(undoLabels()).toEqual([]);
});

test("changes are unsaved until saved, loaded over, or undone back to what was saved", () => {
  const unsaved = () => hasUnsavedChanges(getAppState());
  loadDiagram(diagramOf([component("lb")]), { name: "edge.json" });
  expect(getAppState().file).toEqual({ name: "edge.json" });
  expect(unsaved()).toBe(false);

  setLabel("lb", "Edge");
  expect(unsaved()).toBe(true);
  undo();
  expect(unsaved()).toBe(false);

  redo();
  markSaved(getAppState().diagram, { name: "edge.json", path: "/edge.json" });
  expect(unsaved()).toBe(false);
  expect(getAppState().file).toEqual({ name: "edge.json", path: "/edge.json" });
});

test("adding an object selects it", () => {
  addObject(component("lb"), "Add load balancer");
  expect(selection()).toEqual(["lb"]);
  expect(undoLabels()).toEqual(["Add load balancer"]);
});

test("an object that cannot be added is not selected", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  start();
  addObject(component("lb"), "Add load balancer");
  expect(selection()).toEqual([]);
});

test("sets a component's name and a shape's text", () => {
  start();
  setLabel("lb", "Edge");
  setLabel("box", "Zone A");
  setLabel("gone", "x");
  expect(diagram().objects[0]).toMatchObject({ name: "Edge" });
  expect(diagram().objects[2]).toMatchObject({ text: "Zone A" });
});

test("sets a component's options", () => {
  start();
  setOptions("lb", { sticky: true });
  expect(diagram().objects[0]).toMatchObject({ options: { sticky: true } });
});

test("moves several objects as one step", () => {
  start();
  moveObjects([
    { id: "lb", position: { x: 10, y: 20 } },
    { id: "box", position: { x: 30, y: 40 } },
  ]);
  expect(diagram().objects[0].position).toEqual({ x: 10, y: 20 });
  expect(diagram().objects[2].position).toEqual({ x: 30, y: 40 });
  expect(undoLabels()).toEqual(["Move"]);
});

test("connects two objects when the diagram's rules allow it", () => {
  start();
  expect(canConnect("lb", "box")).toBe(true);
  expect(canConnect("lb", "lb")).toBe(false);
  expect(canConnect("lb", "note")).toBe(false);
  expect(canConnect("web", "lb")).toBe(false);

  connect("lb", "box");
  expect(diagram().connections[1]).toMatchObject({
    from: "lb",
    to: "box",
    label: "",
    direction: "forward",
    line: "solid",
  });
});

test("a connection keeps the sides it was drawn between, leaving out the usual ones", () => {
  start();
  connect("lb", "box", "bottom", "left");
  expect(diagram().connections[1]).toMatchObject({ fromSide: "bottom" });
  expect(diagram().connections[1]).not.toHaveProperty("toSide");
  undo();
  connect("lb", "box", "right", "top");
  expect(diagram().connections[1]).not.toHaveProperty("fromSide");
  expect(diagram().connections[1]).toMatchObject({ toSide: "top" });
});

test("edits a connection; typing its label is one step", () => {
  start();
  setConnectionLabel("web-lb", "H");
  setConnectionLabel("web-lb", "HTTPS");
  setConnectionStyle("web-lb", { line: "dashed" });
  setConnectionStyle("web-lb", { direction: "both" });
  expect(diagram().connections[0]).toMatchObject({
    label: "HTTPS",
    line: "dashed",
    direction: "both",
  });
  expect(undoLabels()).toHaveLength(3);
});

test("removes objects and connections together, and undo brings them all back", () => {
  start();
  remove(["lb", "web-lb", "box"]);
  expect(ids()).toEqual(["web", "note"]);
  expect(diagram().connections).toEqual([]);
  expect(undoLabels()).toEqual(["Delete"]);

  undo();
  expect(ids()).toHaveLength(4);
  expect(diagram().connections).toHaveLength(1);
});

test("removes a connection on its own, and whatever is selected", () => {
  start();
  remove(["web-lb"]);
  expect(diagram().connections).toEqual([]);
  expect(ids()).toHaveLength(4);

  select(["note"]);
  removeSelected();
  expect(ids()).toEqual(["lb", "web", "box"]);
});

test("sets a component's tags as one step", () => {
  start();
  setTags("lb", ["edge"]);
  expect(diagram().objects[0]).toMatchObject({ tags: ["edge"] });
  expect(undoLabels()).toEqual(["Edit tags"]);
});

test("resizing records the new size and position as one step", () => {
  start();
  resizeObject("box", { width: 300, height: 120 }, { x: 70, y: 40 });
  expect(diagram().objects[2]).toMatchObject({ size: { width: 300, height: 120 }, position: { x: 70, y: 40 } });
  expect(undoLabels()).toEqual(["Resize"]);
});

test("nudging moves every selected object, and a run of nudges is one step", () => {
  start();
  select(["lb", "box", "web-lb"]);
  nudgeSelected(1, 0);
  nudgeSelected(0, 10);
  expect(diagram().objects[0].position).toEqual({ x: 1, y: 10 });
  expect(diagram().objects[2].position).toEqual({ x: 1, y: 10 });
  expect(diagram().objects[1].position).toEqual({ x: 0, y: 0 });
  expect(undoLabels()).toEqual(["Move"]);
  undo();
  expect(diagram().objects[0].position).toEqual({ x: 0, y: 0 });
});

test("nudging a different selection is a separate step", () => {
  start();
  select(["lb"]);
  nudgeSelected(1, 0);
  select(["box"]);
  nudgeSelected(1, 0);
  expect(undoLabels()).toEqual(["Move", "Move"]);
  undo();
  expect(diagram().objects[0].position).toEqual({ x: 1, y: 0 });
});

test("making room for a grown node joins the step that made it grow, so one undo puts everything back", () => {
  seed([component("lb", "LB"), component("db", "DB", "database", { position: { x: 0, y: 84 } })]);
  setOptions("lb", { sticky: true });
  makeRoomFor(new Map([["db", { x: 0, y: 144 }]]));
  expect(diagram().objects[1].position).toEqual({ x: 0, y: 144 });
  expect(undoLabels()).toEqual(["Change details"]);
  undo();
  expect(diagram().objects[1].position).toEqual({ x: 0, y: 84 });
  expect(diagram().objects[0]).toMatchObject({ options: {} });
});

const at = (id: string) => diagram().objects.find((object) => object.id === id);

test("moving a group moves everything inside it, as one step", () => {
  seed([boundary("payments"), component("api", "API", "service", { position: { x: 50, y: 80 }, parent: "payments" })]);
  moveObjects([{ id: "payments", position: { x: 100, y: 20 } }]);
  expect(at("api")?.position).toEqual({ x: 150, y: 100 });
  expect(undoLabels()).toEqual(["Move"]);
});

test("nudging a group nudges its contents once, even when they are selected too", () => {
  seed(
    [boundary("payments"), component("api", "API", "service", { position: { x: 50, y: 80 }, parent: "payments" })],
    [],
    ["payments", "api"],
  );
  nudgeSelected(10, 0);
  expect(at("payments")?.position).toEqual({ x: 10, y: 0 });
  expect(at("api")?.position).toEqual({ x: 60, y: 80 });
});

test("a move can put something into a group or take it out, in the same step", () => {
  seed([boundary("payments"), component("web", "Web", "webClient", { position: { x: 600, y: 0 } })]);
  moveObjects([{ id: "web", position: { x: 50, y: 80 }, parent: "payments" }]);
  expect(at("web")).toMatchObject({ position: { x: 50, y: 80 }, parent: "payments" });
  moveObjects([{ id: "web", position: { x: 600, y: 0 }, parent: null }]);
  expect(at("web")).not.toHaveProperty("parent");
  expect(undoLabels()).toEqual(["Move", "Move"]);
});

test("grouping wraps the selection in a new group that fits around it, and selects it", () => {
  seed([
    component("api", "API", "service", { position: { x: 100, y: 100 } }),
    component("db", "DB", "database", { position: { x: 400, y: 100 } }),
  ]);
  groupObjects([
    { id: "api", x: 100, y: 100, width: 224, height: 60 },
    { id: "db", x: 400, y: 100, width: 224, height: 60 },
  ]);
  const group = diagram().objects.find((object) => object.type === "boundary");
  expect(group).toMatchObject({ position: { x: 76, y: 52 }, size: { width: 572, height: 132 }, name: "" });
  expect(at("api")?.parent).toBe(group?.id);
  expect(at("db")?.parent).toBe(group?.id);
  expect(selection()).toEqual([group?.id]);
  expect(undoLabels()).toEqual(["Group into boundary"]);
  undo();
  expect(diagram().objects).toHaveLength(2);
});

test("grouping inside a group keeps the new group there", () => {
  seed([boundary("team"), component("api", "API", "service", { position: { x: 100, y: 100 }, parent: "team" })]);
  groupObjects([{ id: "api", x: 100, y: 100, width: 224, height: 60 }]);
  expect(diagram().objects.find((object) => object.type === "boundary" && object.id !== "team")).toMatchObject({
    parent: "team",
  });
});

test("deleting a boundary keeps what it contained", () => {
  seed([boundary("payments"), component("api", "API", "service", { parent: "payments" })]);
  remove(["payments"]);
  expect(ids()).toEqual(["api"]);
  expect(at("api")).not.toHaveProperty("parent");
});

test("formatting resizes groups to fit as well as moving things", () => {
  seed([boundary("payments"), component("api", "API", "service", { parent: "payments" })]);
  formatLayout(new Map([["api", { x: 24, y: 56 }]]), new Map([["payments", { width: 272, height: 140 }]]));
  expect(at("payments")).toMatchObject({ size: { width: 272, height: 140 } });
  expect(at("api")?.position).toEqual({ x: 24, y: 56 });
  expect(undoLabels()).toEqual(["Format layout"]);
});

test("selecting a group puts everything inside it in scope for the assistant, at any depth", () => {
  seed(
    [
      boundary("team"),
      boundary("payments", { position: { x: 20, y: 40 }, parent: "team" }),
      component("api", "API", "service", { parent: "payments" }),
      component("web", "Web", "webClient"),
    ],
    [],
    ["team"],
  );
  expect(selectionInScope(getAppState()).map((object) => object.id)).toEqual(["team", "payments", "api"]);
  select(["web"]);
  expect(selectionInScope(getAppState()).map((object) => object.id)).toEqual(["web"]);
});

test("grouping can give the new boundary its kind straight away", () => {
  seed([component("api", "API", "service", { position: { x: 100, y: 100 } })]);
  groupObjects([{ id: "api", x: 100, y: 100, width: 224, height: 60 }], "service");
  expect(diagram().objects.find((object) => object.type === "boundary")).toMatchObject({ kind: "service" });
});

test("new things go into the selected boundary, or the boundary of the selected thing", () => {
  seed([
    boundary("team"),
    boundary("payments", { position: { x: 20, y: 40 }, parent: "team" }),
    component("api", "API", "service", { parent: "payments" }),
  ]);
  select(["team"]);
  expect(insertionTarget(getAppState())?.id).toBe("team");
  select(["api"]);
  expect(insertionTarget(getAppState())?.id).toBe("payments");
  select(["api", "team"]);
  expect(insertionTarget(getAppState())).toBeUndefined();
});

test("moving something out of its boundary puts it beside it, in the boundary around that", () => {
  seed([
    boundary("team"),
    boundary("payments", { position: { x: 20, y: 40 }, parent: "team" }),
    component("api", "API", "service", { position: { x: 50, y: 90 }, parent: "payments" }),
  ]);
  moveOutOfBoundary("api");
  expect(at("api")).toMatchObject({ parent: "team", position: { x: 20 + 400 + 40, y: 90 } });
  expect(undoLabels()).toEqual(["Move out of boundary"]);
});

test("growing boundaries to hold their contents joins the step that made it necessary", () => {
  seed([boundary("payments")]);
  addObject(component("api", "API", "service", { position: { x: 380, y: 20 }, parent: "payments" }), "Add service");
  fitBoundariesToContents(new Map([["payments", { position: { x: 0, y: -28 }, size: { width: 628, height: 328 } }]]));
  expect(undoLabels()).toEqual(["Add service"]);
  undo();
  expect(at("payments")).toMatchObject({ position: { x: 0, y: 0 }, size: { width: 400, height: 300 } });
});

test("a proposal changes nothing until accepted, and is then one step to undo", () => {
  seed([component("web"), component("api")], [connection("c1", "web", "api")]);
  const before = diagram();
  expect(propose([objectRemove("api")])).toEqual([]);
  expect(diagram()).toBe(before);
  expect(pending()?.preview.objects.map(({ id }) => id)).toEqual(["web", "api"]);
  expect(pending()?.changes.map(({ id, change }) => [id, change])).toEqual([
    ["api", "removed"],
    ["c1", "removed"],
  ]);

  expect(acceptProposal()).toBe(true);
  expect(ids()).toEqual(["web"]);
  expect(undoLabels()).toEqual(["Assistant edit"]);
  expect(pending()).toBeUndefined();
  expect(getAppState().proposal?.decided).toEqual({ api: "accepted", c1: "accepted" });
});

test("an invalid proposal is refused with its issues", () => {
  seed([component("web")]);
  expect(propose([objectRemove("missing")])[0].code).toBe("unknown_object");
  expect(getAppState().proposal).toBeUndefined();
});

test("a proposal follows the diagram through other edits, dropping only what no longer applies", () => {
  seed([component("web"), component("api")]);
  propose([objectUpdate("web", { name: "Site" }), objectUpdate("api", { name: "Gateway" })]);
  const rows = () => proposalRows(getAppState().proposal as Proposal).map(({ change, status }) => [change.id, status]);

  moveObjects([{ id: "web", position: { x: 300, y: 0 } }]);
  expect(rows()).toEqual([
    ["web", "pending"],
    ["api", "pending"],
  ]);
  expect(pending()?.preview.objects[0].position.x).toBe(300);

  remove(["api"]);
  expect(rows()).toEqual([
    ["web", "pending"],
    ["api", "stale"],
  ]);
  expect(acceptProposal()).toBe(true);
  expect(diagram().objects.map((object) => "name" in object && object.name)).toEqual(["Site"]);
});

test("part of a proposal can be accepted or rejected, leaving the rest proposed", () => {
  seed([component("web")]);
  propose([
    objectAdd(component("api")),
    objectAdd(component("db")),
    connectionAdd(connection("c1", "web", "api")),
    connectionAdd(connection("c2", "api", "db")),
  ]);
  const left = () => pending()?.changes.map(({ id }) => id);

  acceptProposal(["c1"]);
  expect(ids()).toEqual(["web", "api"]);
  expect(left()).toEqual(["db", "c2"]);

  rejectProposal(["db"]);
  expect(left()).toBeUndefined();
  expect(lineIds()).toEqual(["c1"]);
  expect(getAppState().proposal?.decided).toEqual({ api: "accepted", c1: "accepted", db: "rejected", c2: "rejected" });
});

const arrangement = new Map([
  ["web", { x: 40, y: 0 }],
  ["api", { x: 400, y: 0 }],
  ["db", { x: 800, y: 0 }],
]);
const rowsNow = () =>
  proposalRows(getAppState().proposal as Proposal).map(({ change, status }) => [change.id, change.change, status]);
const xs = () => diagram().objects.map(({ id, position }) => [id, position.x]);

test("arranging a proposal places what it adds, and the moves that make room go with it", () => {
  seed([component("web")]);
  propose([objectAdd(component("api"))]);
  expect(pending()).toMatchObject({ arranged: false, layout: undefined });

  arrangeProposal(arrangement);
  const proposal = pending();
  expect(proposal?.arranged).toBe(true);
  expect(proposal?.layout).toHaveLength(1);
  expect(proposal?.preview.objects.map(({ position }) => position.x)).toEqual([40, 400]);
  expect(rowsNow()).toEqual([["api", "added", "pending"]]);
  expect(xs()).toEqual([["web", 0]]);

  acceptProposal();
  expect(xs()).toEqual([
    ["web", 40],
    ["api", 400],
  ]);
  expect(undoLabels()).toEqual(["Assistant edit"]);
});

test("deciding part of a proposal leaves the rest to be arranged again", () => {
  seed([component("web")]);
  propose([objectAdd(component("api")), objectAdd(component("db"))]);
  arrangeProposal(arrangement);

  rejectProposal(["api"]);
  expect(pending()).toMatchObject({ arranged: false, layout: [expect.anything()] });
  expect(rowsNow()).toEqual([
    ["api", "added", "rejected"],
    ["db", "added", "pending"],
  ]);
  arrangeProposal(new Map([["db", { x: 400, y: 0 }]]));
  expect(pending()?.layout).toEqual([]);
  expect(pending()?.preview.objects.map(({ position }) => position.x)).toEqual([0, 400]);
});

test("accepting part of a proposal takes the layout with it, so nothing lands on anything else", () => {
  seed([component("web")]);
  propose([objectAdd(component("api")), objectAdd(component("db"))]);
  arrangeProposal(arrangement);

  acceptProposal(["api"]);
  expect(xs()).toEqual([
    ["web", 40],
    ["api", 400],
  ]);
  expect(pending()).toMatchObject({ arranged: false, layout: [] });
  expect(rowsNow()).toEqual([
    ["api", "added", "accepted"],
    ["db", "added", "pending"],
  ]);
});

test("a move the proposal itself asks for is a change to decide on", () => {
  seed([component("web")]);
  propose([objectUpdate("web", { position: { x: 500, y: 0 } })]);
  expect(rowsNow()).toEqual([["web", "moved", "pending"]]);
});

test("rejecting what a connection was rerouted through keeps the old connection", () => {
  seed([component("api"), component("db")], [connection("c1", "api", "db")]);
  propose([
    objectAdd(component("cache")),
    connectionRemove("c1"),
    connectionAdd(connection("c2", "api", "cache")),
    connectionAdd(connection("c3", "cache", "db")),
    objectUpdate("db", { name: "Orders" }),
  ]);
  rejectProposal(["cache"]);
  expect(rowsNow()).toEqual([
    ["db", "changed", "pending"],
    ["cache", "added", "rejected"],
    ["c2", "added", "rejected"],
    ["c3", "added", "rejected"],
    ["c1", "removed", "rejected"],
  ]);
  acceptProposal();
  expect(lineIds()).toEqual(["c1"]);
});

test("rejecting only the removal keeps the old connection beside the new ones", () => {
  seed([component("api"), component("db")], [connection("c1", "api", "db")]);
  propose([objectAdd(component("cache")), connectionRemove("c1"), connectionAdd(connection("c2", "api", "cache"))]);
  rejectProposal(["c1"]);
  acceptProposal();
  expect(lineIds()).toEqual(["c1", "c2"]);
});

test("an edit the file format would refuse is not made, so what is saved can always be reopened", () => {
  seed([component("api")]);
  setDescription("api", "x".repeat(280));
  setDescription("api", "x".repeat(281));
  expect(diagram().objects[0]).toMatchObject({ description: "x".repeat(280) });
  expect(parseDiagram(serializeDiagram(diagram()))).toEqual({ diagram: diagram() });
});

test("saving ends a run of typing, so undo goes back to what was saved", () => {
  seed([component("api", "Original")]);
  setLabel("api", "Saved");
  markSaved(diagram(), { name: "a.json" });
  setLabel("api", "Later");
  undo();
  expect(diagram().objects[0]).toMatchObject({ name: "Saved" });
  expect(hasUnsavedChanges(getAppState())).toBe(false);
  undo();
  expect(diagram().objects[0]).toMatchObject({ name: "Original" });
});

test.each([
  ["selecting something else", () => select(["db"])],
  ["leaving a field", endEdit],
])("%s ends a run of typing", (_, end) => {
  seed([component("api", "Original"), component("db")]);
  setLabel("api", "One");
  end();
  setLabel("api", "Two");
  expect(undoLabels()).toHaveLength(2);
});

test("something whose id is the name of a built-in property is still an ordinary row", () => {
  seed([]);
  propose([objectAdd(component("constructor"))]);
  expect(rowsNow()).toEqual([["constructor", "added", "pending"]]);
});

test("an arranged template becomes the starting point, unless something else was done to it meanwhile", () => {
  seed([component("web"), component("api")]);
  const loaded = diagram();
  formatLayout(new Map([["api", { x: 300, y: 0 }]]));
  startFromArranged(loaded);
  expect(undoLabels()).toEqual([]);
  expect(hasUnsavedChanges(getAppState())).toBe(false);

  seed([component("web"), component("api")]);
  const again = diagram();
  formatLayout(new Map([["api", { x: 300, y: 0 }]]));
  setLabel("web", "Mine");
  startFromArranged(again);
  expect(undoLabels()).toEqual(["Format layout", "Rename"]);
  expect(hasUnsavedChanges(getAppState())).toBe(true);
});

test("an id that names the prototype is decided like any other", () => {
  seed([]);
  propose([objectAdd(component("__proto__")), objectAdd(component("api"))]);
  rejectProposal(["__proto__"]);
  expect(rowsNow()).toEqual([
    ["__proto__", "added", "rejected"],
    ["api", "added", "pending"],
  ]);
});

test("rejecting an added connection leaves an unrelated removal proposed", () => {
  seed([component("api"), component("db"), component("log")], [connection("c1", "api", "db")]);
  propose([connectionRemove("c1"), connectionAdd(connection("c2", "api", "log"))]);
  rejectProposal(["c2"]);
  expect(rowsNow()).toEqual([
    ["c2", "added", "rejected"],
    ["c1", "removed", "pending"],
  ]);
});

test("a proposal is arranged again once the diagram changes under it, so its old moves never land on newer ones", () => {
  seed([component("web")]);
  propose([objectAdd(component("api"))]);
  arrangeProposal(arrangement);
  expect(pending()?.layout).toHaveLength(1);

  formatLayout(new Map([["web", { x: 200, y: 200 }]]), new Map());
  expect(pending()).toMatchObject({ arranged: false, layout: [] });
  acceptProposal();
  expect(xs()).toEqual([
    ["web", 200],
    ["api", 400],
  ]);
});

test("accepting a connection that takes another's place removes the one it replaces", () => {
  seed([component("api"), component("db")], [connection("c1", "api", "db")]);
  propose([
    connectionRemove("c1"),
    connectionAdd({ ...connection("c2", "api", "db"), label: "reads" }),
    objectUpdate("db", { name: "Orders" }),
  ]);
  expect(acceptProposal(["c2"])).toBe(true);
  expect(lineIds()).toEqual(["c2"]);
  expect(rowsNow()).toEqual([
    ["db", "changed", "pending"],
    ["c2", "added", "accepted"],
    ["c1", "removed", "accepted"],
  ]);
});
