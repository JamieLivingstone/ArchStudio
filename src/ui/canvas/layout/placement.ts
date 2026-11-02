export interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export type Box = Point & Size;

const GAP = 24;
const MAX_RINGS = 12;

function overlaps(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + GAP && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + GAP;
}

export function findFreePosition(centre: Point, size: Size, taken: Box[]): Point {
  const stepX = size.width + GAP;
  const stepY = size.height + GAP;

  for (let ring = 0; ring <= MAX_RINGS; ring++) {
    const offsets: Point[] = [];
    for (let x = -ring; x <= ring; x++) {
      for (let y = -ring; y <= ring; y++) {
        if (Math.max(Math.abs(x), Math.abs(y)) === ring) offsets.push({ x, y });
      }
    }
    offsets.sort(
      (a, b) => a.x ** 2 + a.y ** 2 - (b.x ** 2 + b.y ** 2) || Math.abs(a.y) - Math.abs(b.y) || b.x - a.x || b.y - a.y,
    );

    for (const offset of offsets) {
      const spot = { x: centre.x + offset.x * stepX, y: centre.y + offset.y * stepY };
      if (!taken.some((box) => overlaps({ ...spot, ...size }, box))) return spot;
    }
  }
  return centre;
}
