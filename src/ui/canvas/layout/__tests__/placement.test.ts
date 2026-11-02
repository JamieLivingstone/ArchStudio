import { expect, test } from "vitest";
import { type Box, findFreePosition } from "../placement";

const centre = { x: 500, y: 300 };
const size = { width: 100, height: 60 };
const box = (x: number, y: number): Box => ({ x, y, ...size });

test("uses the centre when nothing is in the way", () => {
  expect(findFreePosition(centre, size, [])).toEqual(centre);
  expect(findFreePosition(centre, size, [box(1000, 1000)])).toEqual(centre);
});

test("moves to the right of a node at the centre, leaving a gap", () => {
  expect(findFreePosition(centre, size, [box(500, 300)])).toEqual({ x: 624, y: 300 });
});

test("then tries the left, below and above", () => {
  const taken = [box(500, 300), box(624, 300)];
  expect(findFreePosition(centre, size, taken)).toEqual({ x: 376, y: 300 });
  taken.push(box(376, 300));
  expect(findFreePosition(centre, size, taken)).toEqual({ x: 500, y: 384 });
  taken.push(box(500, 384));
  expect(findFreePosition(centre, size, taken)).toEqual({ x: 500, y: 216 });
});

test("a node that only partly covers the centre still pushes the new one away", () => {
  expect(findFreePosition(centre, size, [box(560, 320)])).not.toEqual(centre);
});

test("never returns a spot that touches an existing node", () => {
  const taken: Box[] = [];
  for (let count = 0; count < 30; count++) {
    const spot = findFreePosition(centre, size, taken);
    for (const other of taken) {
      const apart = Math.abs(spot.x - other.x) >= size.width || Math.abs(spot.y - other.y) >= size.height;
      expect(apart).toBe(true);
    }
    taken.push({ ...spot, ...size });
  }
});

test("accounts for neighbours of a different size", () => {
  const wide: Box = { x: 500, y: 300, width: 400, height: 60 };
  const spot = findFreePosition(centre, size, [wide]);
  expect(Math.abs(spot.x - 500) >= 250 || Math.abs(spot.y - 300) >= 60).toBe(true);
});
