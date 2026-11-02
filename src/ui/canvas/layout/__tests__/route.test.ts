import { expect, test } from "vitest";
import { type Box, type Run, route, routeAll, toPath } from "../route";

const source = { x: 0, y: 0 };

function crosses(points: { x: number; y: number }[], box: Box) {
  return points.slice(1).some((to, index) => {
    const from = points[index];
    const [left, right] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
    const [top, bottom] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
    return left < box.x + box.width && right > box.x && top < box.y + box.height && bottom > box.y;
  });
}

const turns = (points: unknown[]) => points.length - 2;

test("a level connection with nothing in the way is one straight run", () => {
  expect(route(source, { x: 400, y: 0 }, [])).toEqual([source, { x: 400, y: 0 }]);
});

test("with nothing in the way it turns twice, halfway across", () => {
  expect(route(source, { x: 400, y: 200 }, [])).toEqual([
    source,
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 400, y: 200 },
  ]);
});

test("from the bottom of one node to the top of the one below is one straight run", () => {
  const target = { x: 0, y: 300 };
  expect(route(source, target, [], [], undefined, { from: "bottom", to: "top" })).toEqual([source, target]);
});

test("between the bottom and top of nodes out of line, it turns twice, halfway down", () => {
  expect(route(source, { x: 200, y: 300 }, [], [], undefined, { from: "bottom", to: "top" })).toEqual([
    source,
    { x: 0, y: 150 },
    { x: 200, y: 150 },
    { x: 200, y: 300 },
  ]);
});

test("from a right side to a top side it turns once", () => {
  expect(route(source, { x: 300, y: 200 }, [], [], undefined, { from: "right", to: "top" })).toEqual([
    source,
    { x: 300, y: 0 },
    { x: 300, y: 200 },
  ]);
});

test("from a top side to the bottom of a node below, it loops round rather than through either", () => {
  const [from, to] = [
    { x: -50, y: 0, width: 100, height: 60 },
    { x: -50, y: 240, width: 100, height: 60 },
  ];
  const points = route(source, { x: 0, y: 300 }, [from, to], [], undefined, { from: "top", to: "bottom" });
  expect(points?.[1]).toEqual({ x: 0, y: -20 });
  expect(points?.[points.length - 2]).toEqual({ x: 0, y: 320 });
  expect(points && crosses(points.slice(1, -1), from)).toBe(false);
  expect(points && crosses(points.slice(1, -1), to)).toBe(false);
});

test("out of the top of a node just below a boundary's title, it crosses that title but goes round another", () => {
  const ownTitle = { x: -200, y: -50, width: 400, height: 32 };
  const otherTitle = { x: 100, y: -200, width: 400, height: 32 };
  const points = route(source, { x: 300, y: -400 }, [ownTitle, otherTitle], [], undefined, {
    from: "top",
    to: "bottom",
  });
  expect(points).toBeDefined();
  expect(points && crosses(points, otherTitle)).toBe(false);
});

test("goes round a node that sits where it would have turned", () => {
  const inTheWay = { x: 150, y: 150, width: 100, height: 100 };
  const points = route(source, { x: 400, y: 200 }, [inTheWay]);
  expect(points && crosses(points, inTheWay)).toBe(false);
  expect(points && turns(points)).toBe(2);
});

test("goes round a wall of nodes that no single turn avoids", () => {
  const wall = [
    { x: 100, y: -50, width: 100, height: 100 },
    { x: 100, y: 150, width: 100, height: 100 },
    { x: 220, y: 150, width: 100, height: 100 },
  ];
  const points = route(source, { x: 400, y: 200 }, wall) ?? [];
  expect(points.length).toBeGreaterThan(2);
  expect(wall.some((box) => crosses(points, box))).toBe(false);
});

test("reaches a target that is behind it, leaving right and entering from the left", () => {
  const own = { x: -200, y: -40, width: 200, height: 80 };
  const behind = { x: -600, y: 160, width: 200, height: 80 };
  const points = route(source, { x: -600, y: 200 }, [own, behind]) ?? [];
  expect(points[1]).toEqual({ x: 20, y: 0 });
  expect(points[points.length - 2]).toEqual({ x: -620, y: 200 });
  expect([own, behind].some((box) => crosses(points.slice(1, -1), box))).toBe(false);
});

test("has no route when the way out is walled in", () => {
  const walls = [
    { x: -200, y: -200, width: 400, height: 30 },
    { x: -200, y: 170, width: 400, height: 30 },
    { x: -200, y: -200, width: 30, height: 400 },
    { x: 170, y: -200, width: 30, height: 400 },
  ];
  expect(route(source, { x: 400, y: 0 }, walls)).toBeUndefined();
});

test("draws the corners rounded", () => {
  const points = [source, { x: 100, y: 0 }, { x: 100, y: 300 }, { x: 200, y: 300 }];
  expect(toPath(points, 10)).toBe("M 0 0 L 90 0 Q 100 0 100 10 L 100 290 Q 100 300 110 300 L 200 300");
});

test("in a diagram too large to steer round everything, it still goes round what is near", () => {
  const inTheWay = { x: 150, y: 150, width: 100, height: 100 };
  const farAway = Array.from({ length: 200 }, (_, index) => ({
    x: 5000 + (index % 20) * 300,
    y: 5000 + Math.floor(index / 20) * 300,
    width: 200,
    height: 100,
  }));
  const points = route(source, { x: 400, y: 200 }, [...farAway, inTheWay]);
  expect(points && crosses(points, inTheWay)).toBe(false);
  expect(points && turns(points)).toBe(2);
});

const ends = (points: { x: number; y: number }[] | undefined) => points?.slice(1, -1);

test("a line takes a track of its own beside another, rather than running on top of it", () => {
  const routes = routeAll(
    [
      { id: "first", from: "a", to: "b", source, target: { x: 400, y: 200 } },
      { id: "second", from: "c", to: "d", source: { x: 0, y: 40 }, target: { x: 400, y: 240 } },
    ],
    [],
  );
  const [first, second] = [ends(routes.get("first")), ends(routes.get("second"))];
  expect(first?.[0].x).toBe(200);
  expect(second?.[0].x).not.toBe(200);
});

test("lines from the same node share their trunk", () => {
  const routes = routeAll(
    [
      { id: "up", from: "a", to: "b", source, target: { x: 400, y: -200 } },
      { id: "down", from: "a", to: "c", source, target: { x: 400, y: 200 } },
    ],
    [],
  );
  expect(ends(routes.get("up"))?.[0].x).toBe(ends(routes.get("down"))?.[0].x);
});

test("a line half a pixel from another's run counts as on top of it", () => {
  const drawn: Run[] = [{ horizontal: true, at: 100.5, start: 150, end: 400, from: "x", to: "y" }];
  const points = route(source, { x: 400, y: 100 }, [], drawn, { from: "a", to: "b" });
  expect(points?.some((point) => Math.abs(point.y - 100) < 1 && point.x > 150 && point.x < 380)).toBe(false);
});
