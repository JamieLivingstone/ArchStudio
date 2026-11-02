import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { DiagramOperation } from "../../../diagram/operations";
import { component, connection, diagram, objectAdd, objectRemove, objectUpdate, seed } from "../../../test/diagram";
import { button } from "../../../test/dom";
import type { Proposal } from "../../proposal";
import { arrangeProposal, getAppState, propose, remove } from "../../state";
import { ProposalCard } from "../ProposalCard";

const cache: DiagramOperation = objectAdd(component("cache", "Redis", "cache", { tags: ["Redis"] }));
const proposed: DiagramOperation[] = [
  cache,
  objectUpdate("api", { options: { instances: 3 }, description: "" }),
  objectRemove("db"),
];

function setup(operations = proposed) {
  seed(
    [
      component("web", "Web", "webClient"),
      component("api", "API", "service", { options: { instances: 2 }, description: "Old" }),
      component("db", "DB", "database"),
    ],
    [connection("c1", "api", "db")],
  );
  propose(operations);
  render(<ProposalCard proposal={getAppState().proposal as Proposal} />);
}

const lines = () => screen.getAllByRole("listitem").map((item) => item.textContent?.replace(/RejectAccept$/, ""));
const names = () => diagram().objects.map((object) => "name" in object && object.name);

test("lists every change under what it does, with values before and after", () => {
  setup();
  screen.getByText("4 to decide");
  const headings = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
  expect(headings).toEqual(["Added", "Changed", "Removed"]);
  expect(lines()).toEqual([
    "RedisCache · Tags: Redis",
    "APIServiceDescription: OldInstances: 2 → 3",
    "DBDatabase",
    "API → DBConnection",
  ]);
  expect(screen.getByText("Old").tagName).toBe("DEL");
});

test("pointing at a change focuses on it and picks out its row, and leaving lets go", async () => {
  setup();
  await userEvent.hover(screen.getByText("API"));
  expect(getAppState().focus).toBe("api");
  const picked = screen.getAllByRole("listitem").filter((item) => item.className.includes("bg-hover"));
  expect(picked).toHaveLength(1);
  await userEvent.unhover(screen.getByText("API"));
  expect(getAppState().focus).toBeUndefined();
});

test("each change can be accepted or rejected by itself, unless it follows from another", async () => {
  setup();
  expect(screen.queryByRole("button", { name: "Accept API → DB" })).toBeNull();
  await userEvent.click(button("Accept Redis"));
  await userEvent.click(button("Reject API"));
  expect(names()).toEqual(["Web", "API", "DB", "Redis"]);
  screen.getByText("2 to decide · 1 accepted · 1 rejected");
  expect(lines().slice(0, 2)).toEqual([
    "RedisCache · Tags: RedisAccepted",
    "APIServiceDescription: OldInstances: 2 → 3Rejected",
  ]);
  expect(screen.queryByRole("button", { name: "Accept Redis" })).toBeNull();
});

test("the rest can be decided at once, after which it folds away to its summary", async () => {
  setup();
  await userEvent.click(button("Reject Redis"));
  await userEvent.click(button("Accept the rest"));
  expect(names()).toEqual(["Web", "API"]);
  screen.getByText("3 accepted · 1 rejected");
  expect(screen.queryByRole("button")).toBeNull();
});

test("everything can be rejected at once", async () => {
  setup();
  await userEvent.click(button("Reject all"));
  expect(names()).toEqual(["Web", "API", "DB"]);
  screen.getByText("4 rejected");
});

test("what moves to make room is mentioned, but is nothing to decide on", () => {
  setup([cache]);
  act(() =>
    arrangeProposal(
      new Map([
        ["web", { x: 300, y: 0 }],
        ["api", { x: 600, y: 0 }],
      ]),
    ),
  );
  expect(lines()).toEqual(["RedisCache · Tags: Redis"]);
  screen.getByText("1 to decide");
  screen.getByText("2 things move to make room.");
});

test("what the diagram no longer allows, or a newer proposal replaces, is out of date", () => {
  setup();
  act(() => remove(["api"]));
  screen.getByText("2 to decide · 2 out of date");

  act(() => {
    propose([cache]);
  });
  screen.getByText("4 out of date");
  expect(screen.queryByRole("button")).toBeNull();
});
