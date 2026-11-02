import { expect, test } from "vitest";
import { parseDiagram, serializeDiagram } from "../parse";

const web = { type: "component", id: "web", position: { x: 0, y: 0 }, kind: "webClient", name: "Web" };
const api = { type: "component", id: "api", position: { x: 300, y: 0 }, kind: "service", name: "API" };

test("reads a diagram, filling in what a connection may leave out", () => {
  const text = JSON.stringify({
    schemaVersion: 1,
    objects: [web, api],
    connections: [{ id: "c", from: "web", to: "api" }],
  });
  expect(parseDiagram(text)).toEqual({
    diagram: {
      schemaVersion: 1,
      objects: [
        { ...web, options: {} },
        { ...api, options: {} },
      ],
      connections: [{ id: "c", from: "web", to: "api", label: "", direction: "forward", line: "solid" }],
    },
  });
});

test("refuses text that is not JSON", () => {
  expect(parseDiagram("not json")).toEqual({ error: "This file is not valid JSON." });
});

test("refuses JSON that is not a diagram", () => {
  expect(parseDiagram('{"hello":"world"}')).toEqual({ error: "This file is not an ArchStudio diagram." });
  expect(parseDiagram("null")).toEqual({ error: "This file is not an ArchStudio diagram." });
});

test("a file from a newer version asks for an update rather than calling itself something else", () => {
  expect(parseDiagram(JSON.stringify({ schemaVersion: 2, objects: [], connections: [] }))).toEqual({
    error: "It was saved by a newer version of ArchStudio. Update the app to open it.",
  });
});

test("refuses a diagram that breaks the diagram's rules, saying why", () => {
  const text = JSON.stringify({
    schemaVersion: 1,
    objects: [web],
    connections: [{ id: "c", from: "web", to: "missing" }],
  });
  const result = parseDiagram(text);
  expect("error" in result && result.error).toMatch(/missing/);
});

test("a serialized diagram reads back the same, as indented text ending in a newline", () => {
  const result = parseDiagram(JSON.stringify({ schemaVersion: 1, objects: [web, api], connections: [] }));
  if ("error" in result) throw new Error(result.error);
  const text = serializeDiagram(result.diagram);
  expect(text.startsWith('{\n  "schemaVersion": 1,')).toBe(true);
  expect(text.endsWith("}\n")).toBe(true);
  expect(parseDiagram(text)).toEqual(result);
});
