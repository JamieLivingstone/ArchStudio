import { expect, test } from "vitest";
import { makeRoom } from "../makeRoom";

const node = (id: string, x: number, y: number, height = 60, width = 200) => ({ id, x, y, width, height });

test("a node that grows over the one below pushes it down, keeping their gap", () => {
  // It was 60 tall with 24 below it; it grows to 120.
  const moved = makeRoom(node("lb", 0, 0, 120), 60, [node("db", 0, 84)]);
  expect(moved).toEqual(new Map([["db", { x: 0, y: 144 }]]));
});

test("a smaller gap is kept as it was, and a larger one is not widened", () => {
  expect(makeRoom(node("lb", 0, 0, 120), 60, [node("db", 0, 70)]).get("db")).toEqual({ x: 0, y: 130 });
  expect(makeRoom(node("lb", 0, 0, 120), 60, [node("db", 0, 300)]).size).toBe(0);
});

test("only nodes in the same column move", () => {
  expect(makeRoom(node("lb", 0, 0, 120), 60, [node("aside", 400, 84)]).size).toBe(0);
});

test("nodes above, or that already overlapped it, are left alone", () => {
  expect(makeRoom(node("lb", 0, 100, 120), 60, [node("above", 0, 0)]).size).toBe(0);
  expect(makeRoom(node("lb", 0, 0, 120), 60, [node("overlapping", 0, 30)]).size).toBe(0);
});

test("a pushed node makes room below itself in turn", () => {
  const moved = makeRoom(node("lb", 0, 0, 120), 60, [node("a", 0, 84), node("b", 0, 168)]);
  expect(moved.get("a")).toEqual({ x: 0, y: 144 });
  expect(moved.get("b")).toEqual({ x: 0, y: 228 });
});

test("a stack below a grown node is pushed once each, top to bottom, and always finishes", () => {
  const moved = makeRoom(node("top", 0, 0, 340), 140, [node("a", 0, 156), node("b", 0, 256), node("c", 0, 356)]);
  expect(moved.get("a")).toEqual({ x: 0, y: 356 });
  expect(moved.get("b")).toEqual({ x: 0, y: 456 });
  expect(moved.get("c")).toEqual({ x: 0, y: 556 });
});
