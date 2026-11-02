import type { Position } from "../../../diagram/schema";

interface Placed {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 40;

const sideBySide = (a: Placed, b: Placed) => a.x < b.x + b.width && b.x < a.x + a.width;

export function makeRoom(grown: Placed, previousHeight: number, others: Placed[]): Map<string, Position> {
  const moved = new Map<string, Position>();
  const pushers = [{ box: grown, oldBottom: grown.y + previousHeight, bottom: grown.y + grown.height }];

  const below = others
    .filter((other) => other.id !== grown.id && other.y >= grown.y + previousHeight)
    .sort((a, b) => a.y - b.y);
  for (const other of below) {
    let y = other.y;
    for (const pusher of pushers) {
      if (!sideBySide(pusher.box, other) || other.y < pusher.oldBottom) continue;
      y = Math.max(y, pusher.bottom + Math.min(other.y - pusher.oldBottom, GAP));
    }
    if (y === other.y) continue;
    moved.set(other.id, { x: other.x, y });
    pushers.push({ box: other, oldBottom: other.y + other.height, bottom: y + other.height });
  }
  return moved;
}
