import { expect, test } from "vitest";
import { componentKindNames } from "../../../../diagram/componentKinds";
import { componentCatalog, getComponentDefinition } from "../componentCatalog";

test("every kind in the diagram domain is in exactly one category", () => {
  const listed = componentCatalog.flatMap((category) => category.items.map((item) => item.kind));
  expect([...listed].sort()).toEqual([...componentKindNames].sort());
});

test("a definition has the kind's label and options, plus its icon", () => {
  const definition = getComponentDefinition("loadBalancer");
  expect(definition.label).toBe("Load Balancer");
  expect(definition.options.map((option) => option.key)).toEqual([
    "layer",
    "algorithm",
    "healthChecks",
    "sticky",
    "availability",
  ]);
  expect(definition.icon).toBeTruthy();
});

test("kinds take their category's colour, so categories can be told apart", () => {
  const tones = componentCatalog.map((group) => new Set(group.items.map((item) => item.tone)));
  expect(tones.every((tone) => tone.size === 1)).toBe(true);
  expect(new Set(tones.map((tone) => [...tone][0])).size).toBe(componentCatalog.length);
});
