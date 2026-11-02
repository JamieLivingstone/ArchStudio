import type { Box, Point } from "./placement";

const SNAP_DISTANCE = 6;

export interface Guides {
  x: number[];
  y: number[];
}

const anchors = (centre: number, size: number) => [centre - size / 2, centre, centre + size / 2];

function nearestShift(own: number[], others: number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const mine of own) {
    for (const line of others) {
      const shift = line - mine;
      if (Math.abs(shift) <= SNAP_DISTANCE && Math.abs(shift) < Math.abs(best)) best = shift;
    }
  }
  return Number.isFinite(best) ? best : 0;
}

function touching(own: number[], others: number[]): number[] {
  return [...new Set(others.filter((line) => own.some((mine) => Math.abs(line - mine) < 0.5)))];
}

export function align(moving: Box, others: Box[]): { position: Point; guides: Guides } {
  const otherXs = others.flatMap((box) => anchors(box.x, box.width));
  const otherYs = others.flatMap((box) => anchors(box.y, box.height));
  const x = moving.x + nearestShift(anchors(moving.x, moving.width), otherXs);
  const y = moving.y + nearestShift(anchors(moving.y, moving.height), otherYs);
  return {
    position: { x, y },
    guides: {
      x: touching(anchors(x, moving.width), otherXs),
      y: touching(anchors(y, moving.height), otherYs),
    },
  };
}
