import { expect, test } from "vitest";
import type { Diagram, DiagramObject } from "../../../../diagram/schema";
import { fitBoundaries } from "../fitBoundaries";

const boundary = (id: string, x: number, y: number, width: number, height: number, parent?: string) =>
  ({
    type: "boundary",
    id,
    position: { x, y },
    size: { width, height },
    name: id,
    ...(parent ? { parent } : {}),
  }) as DiagramObject;
const thing = (id: string, x: number, y: number, parent: string) =>
  ({ type: "component", id, position: { x, y }, kind: "service", name: id, options: {}, parent }) as DiagramObject;
const diagramOf = (...objects: DiagramObject[]): Diagram => ({ schemaVersion: 1, objects, connections: [] });
const sizeOf = (object: DiagramObject) => ("size" in object && object.size) || { width: 200, height: 60 };

test("a boundary that already holds its contents is left alone", () => {
  expect(fitBoundaries(diagramOf(boundary("b", 0, 0, 400, 300), thing("a", 24, 48, "b")), sizeOf).size).toBe(0);
});

test("a boundary grows to hold something near or past its edge, keeping room around it", () => {
  const fits = fitBoundaries(diagramOf(boundary("b", 0, 0, 400, 300), thing("a", 300, 280, "b")), sizeOf);
  expect(fits.get("b")).toEqual({ position: { x: 0, y: 0 }, size: { width: 524, height: 364 } });
});

test("it grows up and left too, for something above or left of it", () => {
  const fits = fitBoundaries(diagramOf(boundary("b", 0, 0, 400, 300), thing("a", -50, 10, "b")), sizeOf);
  expect(fits.get("b")).toEqual({ position: { x: -74, y: -38 }, size: { width: 474, height: 338 } });
});

test("growth ripples out through nested boundaries", () => {
  const fits = fitBoundaries(
    diagramOf(boundary("team", 0, 0, 500, 400), boundary("svc", 24, 48, 400, 300, "team"), thing("a", 300, 300, "svc")),
    sizeOf,
  );
  expect(fits.get("svc")?.size).toEqual({ width: 500, height: 336 });
  expect(fits.get("team")?.size).toEqual({ width: 548, height: 408 });
});

test("it never shrinks a boundary, and ignores empty ones", () => {
  expect(fitBoundaries(diagramOf(boundary("b", 0, 0, 900, 900), thing("a", 24, 48, "b")), sizeOf).size).toBe(0);
  expect(fitBoundaries(diagramOf(boundary("b", 0, 0, 10, 10)), sizeOf).size).toBe(0);
});

test("a boundary that grows right moves what is beside it at the same level along, contents and all", () => {
  const changes = fitBoundaries(
    diagramOf(
      boundary("team", 0, 0, 900, 300),
      boundary("one", 24, 48, 320, 200, "team"),
      boundary("two", 384, 48, 320, 200, "team"),
      thing("inTwo", 408, 96, "two"),
      thing("wide", 300, 96, "one"),
    ),
    sizeOf,
  );
  // "one" now ends at 300 + 200 + 24 = 524, 180 further right than before.
  expect(changes.get("one")?.size).toEqual({ width: 500, height: 200 });
  expect(changes.get("two")?.position).toEqual({ x: 384 + 180, y: 48 });
  expect(changes.get("inTwo")?.position).toEqual({ x: 408 + 180, y: 96 });
  expect(changes.get("team")?.size?.width).toBe(384 + 180 + 320 + 24);
});

test("things below a boundary that grows down move down; things elsewhere stay put", () => {
  const free = (id: string, x: number, y: number) =>
    ({ type: "component", id, position: { x, y }, kind: "service", name: id, options: {} }) as DiagramObject;
  const changes = fitBoundaries(
    diagramOf(
      boundary("one", 0, 0, 320, 200),
      thing("deep", 24, 180, "one"),
      free("below", 0, 260),
      free("aside", 600, 260),
    ),
    sizeOf,
  );
  // It now ends at 180 + 60 + 24 = 264, 64 lower than before.
  expect(changes.get("one")?.size?.height).toBe(264);
  expect(changes.get("below")?.position).toEqual({ x: 0, y: 260 + 64 });
  expect(changes.has("aside")).toBe(false);
});
