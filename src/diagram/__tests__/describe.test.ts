import { expect, test } from "vitest";
import { component, connection, diagramOf, shape } from "../../test/fixtures";
import { describeDiagram, describeKinds } from "../describe";
import type { DiagramObject } from "../schema";

const diagram = diagramOf(
  [
    component("api", "Payments API", "service", {
      position: { x: 10, y: 20 },
      description: "Handles payment authorisation, capture and refunds.",
      tags: ["Node.js", "PCI"],
      icon: "CreditCard",
      options: { state: "Stateless", instances: 3 },
    }),
    component("db", "Orders Database", "database", {
      options: { model: "Relational", replication: "Primary-replica", replicaCount: 2, consistency: "Strong" },
      structure: {
        model: "Relational",
        tables: [{ name: "orders", columns: [{ name: "id", primaryKey: true }, { name: "status" }] }],
      },
    }),
    component("q", "Jobs", "queue", { options: { retry: false } }),
    component("bare", "Cache", "cache"),
    shape("stripe", "Stripe", "rectangle", { tags: ["external"], icon: "Wallet" } as Partial<DiagramObject>),
    shape("note", "Draft", "text"),
  ],
  [connection("c1", "api", "db", "SQL"), connection("c2", "api", "stripe", "", { direction: "both", line: "dashed" })],
);

const text = describeDiagram(diagram);

test("describes components with only what was set, and their structure", () => {
  expect(text).toContain(
    '- [api] "Payments API" (Service). Handles payment authorisation, capture and refunds.. Tags: Node.js, PCI. State: Stateless. Instances: 3',
  );
  expect(text).toContain(
    '- [db] "Orders Database" (Database). Data model: Relational. Replication: Primary-replica. Replicas: 2. Consistency: Strong\n  table orders(id PK, status)',
  );
  expect(text).toContain('- [bare] "Cache" (Cache)\n');
});

test("an explicit Off is stated rather than dropped", () => {
  expect(text).toContain('- [q] "Jobs" (Queue). Retry: Off');
});

test("unset details, icons and positions are left out", () => {
  expect(text).not.toMatch(/not specified|undefined|CreditCard|Wallet|position|"x"/i);
});

test("describes shapes, notes and connections", () => {
  expect(text).toContain('Shapes:\n- [stripe] "Stripe" (rectangle). Tags: external');
  expect(text).toContain('Notes:\n- [note] note "Draft"');
  expect(text).toContain('Connections:\n- [c1] [api] -> [db] "SQL"\n- [c2] [api] <-> [stripe] dashed');
});

test("an empty diagram describes as nothing", () => {
  expect(describeDiagram(diagramOf([]))).toBe("");
});

test("the catalogue names every kind and spells out its options", () => {
  const catalogue = describeKinds();
  expect(catalogue).toContain(
    "- cache (Cache): Keeps copies of frequently read data in memory, so reads are faster and the source is spared. Options:\n",
  );
  expect(catalogue).toContain(
    "- database (Database): Stores data durably as the source of truth. Its data model says which kind of database. Options:\n  - model: one of: Relational, Document,",
  );
  expect(catalogue).toContain(
    '  - replicaCount: a whole number of 1 or more. How many extra copies are kept, beyond the first. Only when "replication" is one of: Primary-replica, Multi-primary, Leaderless.',
  );
  expect(catalogue).toContain(
    "Boundary kinds (optional):\n- service: Components deployed and run together as one service.",
  );
  expect(describeKinds()).toContain("  - instances: a whole number of 0 or more.");
});

test("a kind with no options says so", () => {
  expect(describeKinds()).toContain("- cli (CLI): A command-line tool that people or scripts run. No options.");
});
