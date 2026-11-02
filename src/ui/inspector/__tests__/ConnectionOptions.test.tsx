import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Connection } from "../../../diagram/schema";
import { component, connection, diagram, seed } from "../../../test/diagram";
import { ConnectionOptions } from "../ConnectionOptions";

function setup(changes: Partial<Connection> = {}) {
  const line = { ...connection("e1", "a", "b"), ...changes };
  seed([component("a"), component("b")], [line]);
  render(<ConnectionOptions connection={line} />);
  return () => diagram().connections[0];
}

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");
const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

test("reflects the connection's arrowheads and line style", () => {
  setup({ direction: "both", line: "dashed" });
  expect(pressed("Both directions")).toBe("true");
  expect(pressed("Forward")).toBe("false");
  expect(pressed("Dashed")).toBe("true");
  expect(pressed("Solid")).toBe("false");
});

test.each([
  ["Backward", "backward"],
  ["Both directions", "both"],
  ["No arrowheads", "none"],
] as const)("%s sets the direction", async (name, direction) => {
  const saved = setup();
  await click(name);
  expect(saved().direction).toBe(direction);
});

test.each([
  ["Dashed", "dashed"],
  ["Flow", "flow"],
] as const)("%s sets the line style", async (name, line) => {
  const saved = setup();
  await click(name);
  expect(saved()).toMatchObject({ line, direction: "forward" });
});
