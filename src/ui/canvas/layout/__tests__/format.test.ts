import { expect, test } from "vitest";
import { labelWidth, layout } from "../format";

const box = (id: string, height = 60, width = 200) => ({ id, width, height });
const centreY = (positions: Map<string, { x: number; y: number }>, id: string, height: number) =>
  (positions.get(id)?.y ?? 0) + height / 2;

test("lays a chain out left to right, with connected nodes level so lines run straight", async () => {
  const { positions } = await layout(
    [box("web"), box("api", 140), box("db")],
    [
      { from: "web", to: "api" },
      { from: "api", to: "db" },
    ],
    { x: 0, y: 0 },
  );
  const [web, api, db] = ["web", "api", "db"].map((id) => positions.get(id) ?? { x: 0, y: 0 });
  expect(web.x).toBeLessThan(api.x);
  expect(api.x).toBeLessThan(db.x);
  expect(centreY(positions, "web", 60)).toBeCloseTo(centreY(positions, "api", 140), 0);
  expect(centreY(positions, "api", 140)).toBeCloseTo(centreY(positions, "db", 60), 0);
});

test("keeps the layout's top-left corner where it is asked to", async () => {
  const { positions } = await layout([box("a"), box("b")], [{ from: "a", to: "b" }], { x: 500, y: 300 });
  const all = [...positions.values()];
  expect(Math.min(...all.map((position) => position.x))).toBe(500);
  expect(Math.min(...all.map((position) => position.y))).toBe(300);
});

test("nothing overlaps, connected or not", async () => {
  const boxes = [box("a"), box("b"), box("c", 120), box("note", 30, 80)];
  const { positions } = await layout(
    boxes,
    [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
    ],
    { x: 0, y: 0 },
  );
  const rects = boxes.map((each) => ({ ...each, ...(positions.get(each.id) ?? { x: 0, y: 0 }) }));
  for (const [index, one] of rects.entries()) {
    for (const other of rects.slice(index + 1)) {
      const apart =
        one.x + one.width <= other.x ||
        other.x + other.width <= one.x ||
        one.y + one.height <= other.y ||
        other.y + other.height <= one.y;
      expect(apart).toBe(true);
    }
  }
});

test("ignores links to unknown objects and links to themselves", async () => {
  const { positions } = await layout(
    [box("a")],
    [
      { from: "a", to: "a" },
      { from: "a", to: "gone" },
    ],
    { x: 0, y: 0 },
  );
  expect(positions.get("a")).toEqual({ x: 0, y: 0 });
});

test("a node fed by several is level with one of them, so that line and the ones after it run straight", async () => {
  const { positions } = await layout(
    [box("web"), box("mobile"), box("lb"), box("gateway")],
    [
      { from: "web", to: "lb" },
      { from: "mobile", to: "lb" },
      { from: "lb", to: "gateway" },
    ],
    { x: 0, y: 0 },
  );
  const level = centreY(positions, "lb", 60);
  expect([centreY(positions, "web", 60), centreY(positions, "mobile", 60)]).toContain(level);
  expect(centreY(positions, "gateway", 60)).toBe(level);
});

test("nodes of different heights in a chain line up on their middles, where the lines join them", async () => {
  const tall = { ...box("api"), height: 180 };
  const { positions } = await layout(
    [box("web"), tall, box("db")],
    [
      { from: "web", to: "api" },
      { from: "api", to: "db" },
    ],
    { x: 0, y: 0 },
  );
  expect(centreY(positions, "api", 180)).toBe(centreY(positions, "web", 60));
  expect(centreY(positions, "db", 60)).toBe(centreY(positions, "web", 60));
});

test("a node feeding an odd number is level with the middle one", async () => {
  const { positions } = await layout(
    [box("lb"), box("a"), box("b"), box("c")],
    ["a", "b", "c"].map((to) => ({ from: "lb", to })),
    { x: 0, y: 0 },
  );
  const middle = (centreY(positions, "a", 60) + centreY(positions, "c", 60)) / 2;
  expect(centreY(positions, "lb", 60)).toBeCloseTo(middle, 0);
});

const gapBetween = (positions: Map<string, { x: number; y: number }>, left: string, right: string) =>
  (positions.get(right)?.x ?? 0) - ((positions.get(left)?.x ?? 0) + 200);

test("a line passing a node leaves room for its label", async () => {
  const { positions } = await layout(
    [
      box("mobile"),
      box("web"),
      { id: "edge", width: 100, height: 100, group: true },
      { ...box("cdn", 136), parent: "edge" },
      { ...box("gateway", 116), parent: "edge" },
    ],
    [
      { from: "web", to: "cdn" },
      { from: "cdn", to: "gateway" },
      { from: "mobile", to: "gateway" },
    ],
    { x: 0, y: 0 },
  );
  const passing = centreY(positions, "gateway", 116);
  const cdn = positions.get("cdn")?.y ?? 0;
  expect(Math.min(Math.abs(passing - cdn), Math.abs(passing - (cdn + 136)))).toBeGreaterThanOrEqual(40);
});

test("every gap is as wide as the longest label needs, so lines are the same length", async () => {
  const label = "Nightly batch export at 02:00";
  const { positions } = await layout(
    [box("a"), box("b"), box("c")],
    [
      { from: "a", to: "b", label },
      { from: "b", to: "c" },
    ],
    { x: 0, y: 0 },
  );
  expect(gapBetween(positions, "a", "b")).toBe(labelWidth(label) + 64);
  expect(gapBetween(positions, "b", "c")).toBe(labelWidth(label) + 64);
});

test("a group's contents start below its header, however tall", async () => {
  const { positions } = await layout(
    [
      { id: "zone", width: 320, height: 200, group: true, header: 90 },
      { ...box("api"), parent: "zone" },
    ],
    [],
    { x: 0, y: 0 },
  );
  expect((positions.get("api")?.y ?? 0) - (positions.get("zone")?.y ?? 0)).toBe(90);
});

test("a connection with no label leaves the spacing alone", async () => {
  const { positions } = await layout([box("a"), box("b")], [{ from: "a", to: "b" }], { x: 0, y: 0 });
  expect(gapBetween(positions, "a", "b")).toBe(72);
});

test("a label like HTTP gets room to clear its arrowhead", async () => {
  const { positions } = await layout([box("a"), box("b")], [{ from: "a", to: "b", label: "HTTP" }], { x: 0, y: 0 });
  expect(gapBetween(positions, "a", "b")).toBe(labelWidth("HTTP") + 64);
});

test("what is inside a group is laid out within it, the group fits around it, and the flow still runs through", async () => {
  const { positions, sizes } = await layout(
    [
      box("web"),
      { id: "payments", width: 400, height: 260, group: true },
      { ...box("api"), parent: "payments" },
      { ...box("db"), parent: "payments" },
      box("email"),
    ],
    [
      { from: "web", to: "api" },
      { from: "api", to: "db" },
      { from: "api", to: "email" },
    ],
    { x: 0, y: 0 },
  );
  const at = (id: string) => positions.get(id) ?? { x: 0, y: 0 };
  const group = { ...at("payments"), ...(sizes.get("payments") ?? { width: 0, height: 0 }) };
  for (const id of ["api", "db"]) {
    expect(at(id).x).toBeGreaterThanOrEqual(group.x);
    expect(at(id).y).toBeGreaterThan(group.y);
    expect(at(id).x + 200).toBeLessThanOrEqual(group.x + group.width);
    expect(at(id).y + 60).toBeLessThanOrEqual(group.y + group.height);
  }
  expect(at("api").x).toBeLessThan(at("db").x);
  expect(at("web").x + 200).toBeLessThanOrEqual(group.x);
  expect(group.x + group.width).toBeLessThanOrEqual(at("email").x);
});

test("an empty group keeps its size", async () => {
  const { sizes } = await layout([{ id: "zone", width: 400, height: 260, group: true }, box("a")], [], { x: 0, y: 0 });
  expect(sizes.has("zone")).toBe(false);
});

test.each([
  ["from outside a group to something inside it", { from: "web", to: "api" }],
  ["to a group with contents", { from: "web", to: "payments" }],
  ["from something to its own group", { from: "api", to: "payments" }],
])("lays out a connection %s", async (_, link) => {
  const { positions } = await layout(
    [box("web"), { id: "payments", width: 400, height: 260, group: true }, { ...box("api"), parent: "payments" }],
    [link],
    { x: 0, y: 0 },
  );
  expect(positions.size).toBe(3);
});

test("unconnected things keep their left-to-right order in a row, inside boundaries too", async () => {
  const { positions } = await layout(
    [
      { id: "team", width: 320, height: 200, group: true },
      { id: "s1", width: 320, height: 200, group: true, parent: "team", x: 0 },
      { ...box("web"), parent: "s1", x: 10 },
      { ...box("mobile"), parent: "s1", x: 300 },
      { id: "s2", width: 320, height: 200, group: true, parent: "team", x: 500 },
      { id: "s3", width: 320, height: 200, group: true, parent: "team", x: 900 },
    ],
    [],
    { x: 0, y: 0 },
  );
  const x = (id: string) => positions.get(id)?.x ?? 0;
  expect(x("s1")).toBeLessThan(x("s2"));
  expect(x("s2")).toBeLessThan(x("s3"));
  expect(x("web")).toBeLessThan(x("mobile"));
  expect(positions.get("web")?.y).toBe(positions.get("mobile")?.y);
  expect(positions.get("s1")?.y).toBe(positions.get("s2")?.y);
  expect(positions.get("s2")?.y).toBe(positions.get("s3")?.y);
});

test("things in a boundary that connect only to things outside it are stacked, not put in each other's way", async () => {
  const { positions } = await layout(
    [
      box("web"),
      box("mobile"),
      { id: "edge", width: 400, height: 260, group: true },
      { ...box("cdn"), parent: "edge" },
      { ...box("gateway"), parent: "edge" },
    ],
    [
      { from: "web", to: "cdn" },
      { from: "mobile", to: "gateway" },
    ],
    { x: 0, y: 0 },
  );
  const [cdn, gateway] = ["cdn", "gateway"].map((id) => positions.get(id) ?? { x: 0, y: 0 });
  expect(cdn.x).toBe(gateway.x);
  expect(cdn.y).not.toBe(gateway.y);
});
