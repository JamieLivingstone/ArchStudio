import { expect, test } from "vitest";
import { applyOperations } from "../../diagram/apply";
import { diffDiagrams } from "../../diagram/diff";
import { type Diagram, emptyDiagram } from "../../diagram/schema";
import { validateDiagram, validateOperations } from "../../diagram/validate";
import { exampleProposal } from "../exampleProposal";
import { component, connection, diagramOf } from "../fixtures";

function propose(diagram: Diagram) {
  const operations = exampleProposal(diagram);
  expect(validateOperations(diagram, operations)).toEqual([]);
  const after = applyOperations(diagram, operations);
  expect(validateDiagram(after)).toEqual([]);
  return { after, changes: diffDiagrams(diagram, after).map(({ change, title }) => `${change} ${title}`) };
}

test("an empty diagram gets a web client, a service and a database", () => {
  expect(propose(emptyDiagram()).changes).toEqual([
    "added Web",
    "added API",
    "added Orders database",
    "added Web → API",
    "added API → Orders database",
  ]);
});

test("a database gets a cache in front of it, and what reads it a load balancer", () => {
  const diagram = diagramOf(
    [component("web", "Web", "webClient"), component("api", "API", "service"), component("db", "DB", "database")],
    [connection("c1", "web", "api"), connection("c2", "api", "db", "SQL")],
  );
  expect(propose(diagram).changes).toEqual([
    "changed DB",
    "added Redis cache",
    "added Load balancer",
    "added API → Redis cache",
    "added Redis cache → DB",
    "added Web → Load balancer",
    "added Load balancer → API",
    "removed Web → API",
    "removed API → DB",
  ]);
});

test("anything else gets monitoring, and each proposal after the first is still valid", () => {
  const first = propose(diagramOf([component("api", "API", "service")]));
  expect(first.changes).toEqual(["changed API", "added Monitoring", "added API → Monitoring"]);
  expect(propose(first.after).changes).toEqual(["added Monitoring", "added API → Monitoring"]);
});
