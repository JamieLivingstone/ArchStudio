import { expect, test } from "vitest";
import { diagramSchema } from "../../../diagram/schema";
import { validateDiagram } from "../../../diagram/validate";
import { templates } from "../templates";

test.each(templates)("the $name template is a valid diagram", ({ diagram }) => {
  expect(diagramSchema.parse(diagram)).toEqual(diagram);
  expect(validateDiagram(diagram)).toEqual([]);
});

test("templates have their own ids", () => {
  expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length);
});
