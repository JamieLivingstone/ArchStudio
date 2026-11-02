import { expect, test } from "vitest";
import { align } from "../alignment";

const other = { x: 50, y: 20, width: 100, height: 40 };
const box = (x: number, y: number, width = 60, height = 20) => ({ x, y, width, height });

test("a box far from the others stays put, with no guides", () => {
  expect(align(box(500, 500), [other])).toEqual({ position: { x: 500, y: 500 }, guides: { x: [], y: [] } });
});

test("snaps centre to centre", () => {
  expect(align(box(54, 300), [other])).toEqual({ position: { x: 50, y: 300 }, guides: { x: [50], y: [] } });
});

test("snaps edge to edge: left to left, and top to bottom", () => {
  expect(align(box(33, 300), [other])).toEqual({ position: { x: 30, y: 300 }, guides: { x: [0], y: [] } });
  expect(align(box(300, 54), [other])).toEqual({ position: { x: 300, y: 50 }, guides: { x: [], y: [40] } });
});

test("shows a guide for every line it sits on, not just the one it snapped to", () => {
  expect(align(box(53, 300, 100, 20), [other]).guides.x).toEqual([0, 50, 100]);
});

test("snaps on both axes at once", () => {
  expect(align(box(52, 24), [other])).toEqual({ position: { x: 50, y: 20 }, guides: { x: [50], y: [20] } });
});

test("does not snap from further than a few units away", () => {
  expect(align(box(58, 300), [other]).guides).toEqual({ x: [], y: [] });
});

test("prefers the closest line when several are in reach", () => {
  const near = { x: 52, y: 500, width: 100, height: 40 };
  expect(align(box(53, 300), [other, near]).position).toEqual({ x: 52, y: 300 });
});
