import { expect, test } from "vitest";
import { fitViewport } from "../fit";

const pane = { width: 1000, height: 600 };
const padding = { top: 0, right: 0, bottom: 0, left: 0 };
const zooms = { minZoom: 0.5, maxZoom: 1 };

test("centres a diagram that fits", () => {
  expect(fitViewport({ x: 0, y: 0, width: 1000, height: 1200 }, pane, padding, zooms)).toEqual({
    x: 250,
    y: 0,
    zoom: 0.5,
  });
});

test("never zooms in past the largest zoom", () => {
  expect(fitViewport({ x: 0, y: 0, width: 200, height: 100 }, pane, padding, zooms)).toEqual({
    x: 400,
    y: 250,
    zoom: 1,
  });
});

test("starts from the left edge of a diagram too wide to read whole, still centred top to bottom", () => {
  expect(fitViewport({ x: 100, y: 0, width: 4000, height: 400 }, pane, padding, zooms)).toEqual({
    x: -50,
    y: 200,
    zoom: 0.5,
  });
});

test("starts from the top of a diagram too tall to read whole", () => {
  expect(fitViewport({ x: 0, y: 50, width: 400, height: 4000 }, pane, padding, zooms)).toEqual({
    x: 400,
    y: -25,
    zoom: 0.5,
  });
});

test("keeps clear of the padding", () => {
  const padded = { top: 20, right: 0, bottom: 0, left: 80 };
  expect(fitViewport({ x: 0, y: 0, width: 4000, height: 400 }, pane, padded, zooms)).toEqual({
    x: 80,
    y: 210,
    zoom: 0.5,
  });
});
