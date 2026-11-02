import { expect, test } from "vitest";
import { type LabelRoute, placeLabels, pointAlong } from "../labels";

const source = { x: 0, y: 0 };

test("a point halfway along a line falls on whichever run is there", () => {
  expect(pointAlong([source, { x: 400, y: 0 }], 0.5)).toEqual({ x: 200, y: 0 });
  expect(pointAlong([source, { x: 200, y: 0 }, { x: 200, y: 60 }, { x: 400, y: 60 }], 0.5)).toEqual({ x: 200, y: 30 });
  expect(pointAlong([source, { x: 100, y: 0 }, { x: 100, y: 300 }, { x: 150, y: 300 }], 0.5)).toEqual({
    x: 100,
    y: 125,
  });
  expect(pointAlong([source], 0.5)).toEqual(source);
});

test("a label on its own sits halfway along its line", () => {
  const placed = placeLabels([{ id: "a", points: [source, { x: 400, y: 0 }], text: "Reads" }], []);
  expect(placed.get("a")).toEqual({ x: 200, y: 0 });
});

test("an unlabelled line gets no label", () => {
  expect(placeLabels([{ id: "a", points: [source, { x: 400, y: 0 }], text: "" }], []).size).toBe(0);
});

test("two lines into the same node put their labels on the stretches that are their own, apart", () => {
  const routes: LabelRoute[] = [
    {
      id: "first",
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
        { x: 600, y: 300 },
      ],
      text: "Fetch creds",
    },
    {
      id: "second",
      points: [
        { x: 0, y: 100 },
        { x: 500, y: 100 },
        { x: 500, y: 300 },
        { x: 600, y: 300 },
      ],
      text: "Fetch creds",
    },
  ];
  const placed = placeLabels(routes, []);
  const [first, second] = [placed.get("first"), placed.get("second")];
  expect(first?.y).toBe(0);
  expect(second?.y).toBe(100);
  expect(first?.x).toBeLessThan(500);
});

test("lines leaving from the same point keep their labels off the run they share and clear of each other", () => {
  const routes: LabelRoute[] = [0, 80, 160].map((y, index) => ({
    id: `line-${index}`,
    points: [source, { x: 100, y: 0 }, { x: 100, y }, { x: 300, y }],
    text: "Logs/metrics/traces",
  }));
  const placed = [...placeLabels(routes, []).values()];
  expect(placed.filter(({ y }) => y === 0)).toHaveLength(1);
  for (const [index, a] of placed.entries()) {
    for (const b of placed.slice(index + 1)) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(22);
  }
});

test("labels keep clear of the nodes where they can", () => {
  const node = { x: 180, y: -30, width: 60, height: 60 };
  const placed = placeLabels([{ id: "a", points: [source, { x: 600, y: 0 }], text: "Reads" }], [node]);
  const { x } = placed.get("a") ?? source;
  expect(x < 180 - 25 || x > 240 + 25).toBe(true);
});

test("when nowhere is clear, a label still goes halfway", () => {
  const routes: LabelRoute[] = ["a", "b"].map((id) => ({ id, points: [source, { x: 20, y: 0 }], text: "Same" }));
  const placed = placeLabels(routes, []);
  expect(placed.get("b")).toEqual({ x: 10, y: 0 });
});
