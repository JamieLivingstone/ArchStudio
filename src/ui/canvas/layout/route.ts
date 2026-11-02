import type { Position, Side } from "../../../diagram/schema";

export interface Box extends Position {
  width: number;
  height: number;
}

// How close a line may pass a node, how far it runs straight out of and into a node, and what a turn
// costs in pixels of detour: a line would rather go this much further than turn once more.
const CLEARANCE = 12;
const STUB = 20;
const TURN = 60;
const MOST_OBSTACLES = 60;
const SHARED = 3;
const LANE = 48;
const NEAR = 240;

export interface Run {
  horizontal: boolean;
  at: number;
  start: number;
  end: number;
  from: string;
  to: string;
}

const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

// East, south, west, north.
const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const OUTWARD: Record<Side, number> = { right: 0, bottom: 1, left: 2, top: 3 };

function nearest(obstacles: Box[], start: Position, end: Position): Box[] {
  if (obstacles.length <= MOST_OBSTACLES) return obstacles;
  const [left, right] = [Math.min(start.x, end.x), Math.max(start.x, end.x)];
  const [top, bottom] = [Math.min(start.y, end.y), Math.max(start.y, end.y)];
  const away = (box: Box) =>
    Math.max(left - box.x - box.width, box.x - right, 0) + Math.max(top - box.y - box.height, box.y - bottom, 0);
  return obstacles
    .map((box) => ({ box, distance: away(box) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MOST_OBSTACLES)
    .map(({ box }) => box);
}

// Dijkstra over a grid of lines just clear of every node, tracking the direction each point was reached from.
export function route(
  source: Position,
  target: Position,
  obstacles: Box[],
  others: Run[] = [],
  ends = { from: "", to: "" },
  sides: { from: Side; to: Side } = { from: "right", to: "left" },
): Position[] | undefined {
  const [leaving, entering] = [OUTWARD[sides.from], (OUTWARD[sides.to] + 2) % 4];
  const stub = (point: Position, direction: number) => ({
    x: point.x + STEPS[direction][0] * STUB,
    y: point.y + STEPS[direction][1] * STUB,
  });
  const start = stub(source, leaving);
  const end = stub(target, OUTWARD[sides.to]);
  const upright = sides.from === "top" || sides.from === "bottom";
  const middle = upright ? (start.y + end.y) / 2 : (start.x + end.x) / 2;
  const near = (run: Run) => {
    const [low, high] = run.horizontal ? [start.y, end.y] : [start.x, end.x];
    return Math.min(low, high) - NEAR <= run.at && run.at <= Math.max(low, high) + NEAR;
  };
  const [runsAcross, runsDown] = [true, false].map((horizontal) =>
    others.filter((run) => run.horizontal === horizontal && run.from !== ends.from && run.to !== ends.to && near(run)),
  );
  const shared = (horizontal: boolean, at: number, from: number, to: number) =>
    (horizontal ? runsAcross : runsDown)
      .filter((run) => Math.abs(run.at - at) < LANE)
      .reduce(
        (length, run) =>
          length + Math.max(0, Math.min(Math.max(from, to), run.end) - Math.max(Math.min(from, to), run.start)),
        0,
      );
  const lanes = (runs: Run[]) => runs.flatMap((run) => [run.at - LANE, run.at + LANE]);
  const contains = (box: { left: number; right: number; top: number; bottom: number }, point: Position) =>
    box.left < point.x && point.x < box.right && box.top < point.y && point.y < box.bottom;
  const grown = nearest(obstacles, start, end)
    .map((box) => ({
      left: box.x - CLEARANCE,
      right: box.x + box.width + CLEARANCE,
      top: box.y - CLEARANCE,
      bottom: box.y + box.height + CLEARANCE,
    }))
    .filter((box) => !contains(box, start) && !contains(box, end));
  const xs = sorted([
    start.x,
    end.x,
    ...(upright ? [] : [middle]),
    ...grown.flatMap((box) => [box.left, box.right]),
    ...lanes(runsDown),
  ]);
  const ys = sorted([
    start.y,
    end.y,
    ...(upright ? [middle] : []),
    ...grown.flatMap((box) => [box.top, box.bottom]),
    ...lanes(runsAcross),
  ]);

  const across = ys.map((y) => grown.filter((box) => box.top < y && y < box.bottom));
  const down = xs.map((x) => grown.filter((box) => box.left < x && x < box.right));
  const blocked = (ix: number, iy: number, direction: number) => {
    const [dx, dy] = STEPS[direction];
    if (dx !== 0) {
      const [from, to] = [xs[Math.min(ix, ix + dx)], xs[Math.max(ix, ix + dx)]];
      return across[iy].some((box) => box.left < to && from < box.right);
    }
    const [from, to] = [ys[Math.min(iy, iy + dy)], ys[Math.max(iy, iy + dy)]];
    return down[ix].some((box) => box.top < to && from < box.bottom);
  };

  const state = (ix: number, iy: number, direction: number) => (iy * xs.length + ix) * 4 + direction;
  const cost = new Float64Array(xs.length * ys.length * 4).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(cost.length).fill(-1);
  const first = state(xs.indexOf(start.x), ys.indexOf(start.y), leaving);
  const [endX, endY] = [xs.indexOf(end.x), ys.indexOf(end.y)];
  cost[first] = 0;
  const queue: [reached: number, state: number][] = [[0, first]];
  const swap = (a: number, b: number) => {
    [queue[a], queue[b]] = [queue[b], queue[a]];
  };
  const add = (entry: [number, number]) => {
    queue.push(entry);
    for (let at = queue.length - 1, parent = (at - 1) >> 1; at > 0 && queue[parent][0] > queue[at][0]; ) {
      swap(at, parent);
      at = parent;
      parent = (at - 1) >> 1;
    }
  };
  const take = () => {
    const [top, end] = [queue[0], queue.pop() as [number, number]];
    if (queue.length === 0) return top;
    queue[0] = end;
    for (let at = 0; ; ) {
      const [left, right] = [2 * at + 1, 2 * at + 2];
      let least = at;
      if (left < queue.length && queue[left][0] < queue[least][0]) least = left;
      if (right < queue.length && queue[right][0] < queue[least][0]) least = right;
      if (least === at) return top;
      swap(at, least);
      at = least;
    }
  };
  let best = -1;
  let bestCost = Number.POSITIVE_INFINITY;

  while (queue.length > 0) {
    const [reached, current] = take();
    if (reached > cost[current]) continue;
    if (reached >= bestCost) break;

    const direction = current % 4;
    const ix = Math.floor(current / 4) % xs.length;
    const iy = Math.floor(current / 4 / xs.length);
    if (ix === endX && iy === endY) {
      const arriving = cost[current] + (direction === entering ? 0 : TURN);
      if (arriving < bestCost) [best, bestCost] = [current, arriving];
      continue;
    }

    for (let next = 0; next < 4; next++) {
      if (next === (direction + 2) % 4) continue;
      const [dx, dy] = STEPS[next];
      const [nx, ny] = [ix + dx, iy + dy];
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length || blocked(ix, iy, next)) continue;
      const length = Math.abs(xs[nx] - xs[ix]) + Math.abs(ys[ny] - ys[iy]);
      const crossing = upright ? dx !== 0 : dy !== 0;
      const offCentre = crossing ? length * Math.abs((upright ? ys[iy] : xs[ix]) - middle) * 1e-4 : 0;
      const overlap = dy === 0 ? shared(true, ys[iy], xs[ix], xs[nx]) : shared(false, xs[ix], ys[iy], ys[ny]);
      const total = cost[current] + length + offCentre + SHARED * overlap + (next === direction ? 0 : TURN);
      const neighbour = state(nx, ny, next);
      if (total >= cost[neighbour]) continue;
      cost[neighbour] = total;
      add([total, neighbour]);
      cameFrom[neighbour] = current;
    }
  }
  if (best < 0) return undefined;

  const points: Position[] = [target];
  for (let current = best; current >= 0; current = cameFrom[current]) {
    const index = Math.floor(current / 4);
    points.push({ x: xs[index % xs.length], y: ys[Math.floor(index / xs.length)] });
  }
  points.push(source);
  points.reverse();
  return points.filter((point, index) => {
    const [before, after] = [points[index - 1], points[index + 1]];
    if (!before || !after) return true;
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

export interface RouteRequest {
  id: string;
  from: string;
  to: string;
  source: Position;
  target: Position;
  fromSide?: Side;
  toSide?: Side;
}

export function routeAll(requests: RouteRequest[], obstacles: Box[]): Map<string, Position[]> {
  const span = ({ source, target }: RouteRequest) => Math.abs(target.x - source.x) + Math.abs(target.y - source.y);
  const routes = new Map<string, Position[]>();
  const runs: Run[] = [];
  for (const { id, from, to, source, target, fromSide = "right", toSide = "left" } of [...requests].sort(
    (a, b) => span(a) - span(b),
  )) {
    const points = route(source, target, obstacles, runs, { from, to }, { from: fromSide, to: toSide });
    if (!points) continue;
    routes.set(id, points);
    for (const [index, next] of points.slice(1).entries()) {
      const point = points[index];
      const horizontal = point.y === next.y;
      const [a, b] = horizontal ? [point.x, next.x] : [point.y, next.y];
      runs.push({
        horizontal,
        at: horizontal ? point.y : point.x,
        start: Math.min(a, b),
        end: Math.max(a, b),
        from,
        to,
      });
    }
  }
  return routes;
}

export function toPath(points: Position[], radius: number): string {
  return points
    .map((point, index) => {
      const [before, after] = [points[index - 1], points[index + 1]];
      if (!before) return `M ${point.x} ${point.y}`;
      if (!after) return `L ${point.x} ${point.y}`;
      const into = Math.hypot(point.x - before.x, point.y - before.y);
      const out = Math.hypot(after.x - point.x, after.y - point.y);
      const size = Math.min(radius, into / 2, out / 2);
      const from = {
        x: point.x - ((point.x - before.x) / into) * size,
        y: point.y - ((point.y - before.y) / into) * size,
      };
      const to = { x: point.x + ((after.x - point.x) / out) * size, y: point.y + ((after.y - point.y) / out) * size };
      return `L ${from.x} ${from.y} Q ${point.x} ${point.y} ${to.x} ${to.y}`;
    })
    .join(" ");
}
