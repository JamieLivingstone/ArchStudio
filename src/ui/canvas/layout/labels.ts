import type { Position } from "../../../diagram/schema";
import type { Box } from "./route";

export interface LabelRoute {
  id: string;
  points: Position[];
  text: string;
}

const CHARACTER = 6.5;
const PADDING = 16;
const HEIGHT = 22;
const GAP = 4;
const STEP = 0.05;
const FURTHEST = 0.4;

const lengthOf = (points: Position[]) =>
  points
    .slice(1)
    .reduce((sum, to, index) => sum + Math.abs(to.x - points[index].x) + Math.abs(to.y - points[index].y), 0);

export function pointAlong(points: Position[], fraction: number): Position {
  let left = lengthOf(points) * fraction;
  for (let index = 1; index < points.length; index++) {
    const [from, to] = [points[index - 1], points[index]];
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    if (left <= length && length > 0) {
      return { x: from.x + ((to.x - from.x) * left) / length, y: from.y + ((to.y - from.y) * left) / length };
    }
    left -= length;
  }
  return points[0];
}

function onRoute(points: Position[], point: Position): boolean {
  return points.slice(1).some((to, index) => {
    const from = points[index];
    const within = (a: number, b: number, value: number) => Math.min(a, b) - 1 <= value && value <= Math.max(a, b) + 1;
    return (
      (Math.abs(from.x - to.x) < 1 && Math.abs(point.x - from.x) < 1 && within(from.y, to.y, point.y)) ||
      (Math.abs(from.y - to.y) < 1 && Math.abs(point.y - from.y) < 1 && within(from.x, to.x, point.x))
    );
  });
}

const overlaps = (a: Box, b: Box, gap = 0) =>
  a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;

export function placeLabels(routes: LabelRoute[], nodes: Box[]): Map<string, Position> {
  const placed = new Map<string, Position>();
  const taken: Box[] = [];
  const fractions = [0.5];
  for (let away = STEP; away <= FURTHEST + 1e-9; away += STEP) fractions.push(0.5 - away, 0.5 + away);

  for (const { id, points, text } of routes) {
    if (!text || points.length < 2) continue;
    const [width, height] = [text.length * CHARACTER + PADDING, HEIGHT];
    const candidates = fractions.map((fraction) => {
      const point = pointAlong(points, fraction);
      const box = { x: point.x - width / 2, y: point.y - height / 2, width, height };
      return {
        point,
        box,
        alone: !routes.some((other) => other.id !== id && onRoute(other.points, point)),
        clearOfLabels: !taken.some((label) => overlaps(label, box, GAP)),
        clearOfNodes: !nodes.some((node) => overlaps(node, box)),
      };
    });
    const chosen =
      candidates.find(({ alone, clearOfLabels, clearOfNodes }) => alone && clearOfLabels && clearOfNodes) ??
      candidates.find(({ clearOfLabels, clearOfNodes }) => clearOfLabels && clearOfNodes) ??
      candidates.find(({ clearOfLabels }) => clearOfLabels) ??
      candidates[0];
    placed.set(id, chosen.point);
    taken.push(chosen.box);
  }
  return placed;
}
