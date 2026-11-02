import { describe, expect, test } from "vitest";
import { codes, diagramOf, objectAdd, objectUpdate } from "../../test/fixtures";
import { applyOperations } from "../apply";
import {
  type DatabaseStructure,
  dataModels,
  describeStructureSize,
  emptyStructure,
  structureToText,
  summarizeStructure,
} from "../databaseStructure";
import type { DiagramOperation } from "../operations";
import { type Diagram, type DiagramObject, diagramSchema } from "../schema";
import { validateDiagram, validateOperation, validateOperations } from "../validate";

const database = (options: Record<string, string> = {}, structure?: DatabaseStructure): DiagramObject => ({
  type: "component",
  id: "db",
  position: { x: 0, y: 0 },
  kind: "database",
  name: "Orders Database",
  options,
  ...(structure ? { structure } : {}),
});

const diagramWith = (object: DiagramObject): Diagram => diagramOf([object]);

function roundTrip(structure: DatabaseStructure) {
  const operations: DiagramOperation[] = [
    objectAdd(database()),
    objectUpdate("db", { options: { model: structure.model }, structure }),
  ];
  const empty: Diagram = diagramOf([]);
  expect(validateOperations(empty, operations)).toEqual([]);
  const next = applyOperations(empty, operations);
  expect(validateDiagram(next)).toEqual([]);
  const read = diagramSchema.parse(JSON.parse(JSON.stringify(next)));
  expect(read.objects[0]).toMatchObject({ structure });
  return read;
}

const examples: Record<DatabaseStructure["model"], { structure: DatabaseStructure; text: string[] }> = {
  Relational: {
    structure: {
      model: "Relational",
      tables: [
        {
          name: "orders",
          columns: [
            { name: "id", type: "uuid", primaryKey: true },
            { name: "customer_id", type: "uuid", references: "customers.id" },
            { name: "status", type: "string" },
          ],
          partitionKey: "customer_id",
        },
      ],
    },
    text: ["table orders(id uuid PK, customer_id uuid -> customers.id, status string), partitioned by customer_id"],
  },
  "Key-value": {
    structure: {
      model: "Key-value",
      patterns: [
        { name: "Session", key: "session:{session_id}", value: "user_id, permissions, expires_at", ttl: "30m" },
        { key: "user:{user_id}:timeline", value: "ordered post IDs" },
      ],
    },
    text: [
      "Session; key session:{session_id}; value user_id, permissions, expires_at; ttl 30m",
      "key user:{user_id}:timeline; value ordered post IDs",
    ],
  },
  Document: {
    structure: {
      model: "Document",
      collections: [{ name: "users", id: "_id", fields: ["name", "email", "preferences"], nested: "addresses" }],
    },
    text: ["collection users; id _id; fields name, email, preferences; nested addresses"],
  },
  "Wide-column": {
    structure: {
      model: "Wide-column",
      tables: [{ name: "messages", partitionKey: "chat_id", sortKey: "sent_at", columns: ["sender_id", "body"] }],
    },
    text: ["table messages; partition key chat_id; sort key sent_at; columns sender_id, body"],
  },
  Graph: {
    structure: {
      model: "Graph",
      nodeTypes: ["User", "Product"],
      relationships: [
        { name: "FOLLOWS", from: "User", to: "User" },
        { name: "PURCHASED", from: "User", to: "Product" },
      ],
    },
    text: ["node types User, Product", "User -[FOLLOWS]-> User", "User -[PURCHASED]-> Product"],
  },
  "Time-series": {
    structure: {
      model: "Time-series",
      series: [
        {
          name: "cpu_usage",
          timestamp: "timestamp",
          dimensions: ["host_id", "region"],
          values: ["usage_percent"],
          retention: "30d",
        },
      ],
    },
    text: ["series cpu_usage; timestamp timestamp; dimensions host_id, region; values usage_percent; retention 30d"],
  },
  Vector: {
    structure: {
      model: "Vector",
      collections: [
        {
          name: "property_embeddings",
          id: "id",
          metadata: ["property_id", "postcode", "property_type"],
          filterable: ["postcode", "property_type"],
          source: "listing descriptions",
        },
      ],
    },
    text: [
      "collection property_embeddings; id id; metadata property_id, postcode, property_type; filterable postcode, property_type; source listing descriptions",
    ],
  },
  Other: {
    structure: { model: "Other", description: "Append-only ledger files, one per account." },
    text: ["Append-only ledger files, one per account."],
  },
};

describe.each(dataModels)("%s structure", (model) => {
  const { structure, text } = examples[model];

  test("round-trips through operations, validation and JSON", () => {
    roundTrip(structure);
  });

  test("reads as concise text for a model", () => {
    expect(structureToText(structure)).toEqual(text);
  });

  test("starts empty and says nothing until filled in", () => {
    expect(emptyStructure(model).model).toBe(model);
    expect(structureToText(emptyStructure(model))).toEqual([]);
    expect(describeStructureSize(emptyStructure(model))).toBeTruthy();
  });
});

test("blank optional parts are left out of the text", () => {
  expect(
    structureToText({ model: "Relational", tables: [{ name: "orders", columns: [{ name: "id" }, { name: " " }] }] }),
  ).toEqual(["table orders(id)"]);
});

test("a database is complete with no data model or structure at all", () => {
  expect(validateDiagram(diagramWith(database()))).toEqual([]);
});

describe("a structure must match the data model", () => {
  const relational = examples.Relational.structure;

  test("a structure for another model, or with no model chosen, is rejected", () => {
    expect(codes(validateDiagram(diagramWith(database({ model: "Key-value" }, relational))))).toEqual([
      "structure_mismatch",
    ]);
    expect(codes(validateDiagram(diagramWith(database({}, relational))))).toEqual(["structure_mismatch"]);
  });

  test("changing the data model alone would orphan the structure, so it is refused", () => {
    const diagram = diagramWith(database({ model: "Relational" }, relational));
    const operation: DiagramOperation = objectUpdate("db", { options: { model: "Key-value" } });
    expect(codes(validateOperation(diagram, operation))).toEqual(["structure_mismatch"]);
  });

  test("changing it together with removing the structure is accepted", () => {
    const diagram = diagramWith(database({ model: "Relational" }, relational));
    const operation: DiagramOperation = objectUpdate("db", { options: { model: "Key-value" }, structure: null });
    expect(validateOperation(diagram, operation)).toEqual([]);
    expect(applyOperations(diagram, [operation]).objects[0]).not.toHaveProperty("structure");
  });

  test("only a database has a structure", () => {
    const cache = { ...database(), kind: "cache", options: {}, structure: relational } as DiagramObject;
    expect(codes(validateDiagram(diagramWith(cache)))).toEqual(["field_not_applicable"]);
  });

  test("a database that changes kind loses its structure", () => {
    const diagram = diagramWith(database({ model: "Relational" }, relational));
    const next = applyOperations(diagram, [objectUpdate("db", { kind: "cache" })]);
    expect(next.objects[0]).not.toHaveProperty("structure");
    expect(validateDiagram(next)).toEqual([]);
  });
});

describe("summarizeStructure", () => {
  test("names each thing with its parts, leaving out blanks", () => {
    expect(
      summarizeStructure({
        model: "Relational",
        tables: [
          {
            name: "orders",
            columns: [{ name: "id", type: "uuid", primaryKey: true }, { name: " " }, { name: "total" }],
          },
          { name: " ", columns: [] },
        ],
      }),
    ).toEqual([{ name: "orders", parts: ["id", "total"] }]);
    expect(
      summarizeStructure({
        model: "Wide-column",
        tables: [{ name: "messages", partitionKey: "conversation_id", sortKey: "sent_at", columns: ["body"] }],
      }),
    ).toEqual([{ name: "messages", parts: ["conversation_id", "sent_at", "body"] }]);
    expect(
      summarizeStructure({
        model: "Key-value",
        patterns: [
          { key: "session:{id}", value: "user" },
          { name: "Cart", key: "cart:{user}" },
        ],
      }),
    ).toEqual([
      { name: "session:{id}", parts: ["user"] },
      { name: "Cart", parts: ["cart:{user}"] },
    ]);
    expect(
      summarizeStructure({
        model: "Graph",
        nodeTypes: ["User"],
        relationships: [{ name: "FOLLOWS", from: "User", to: "User" }],
      }),
    ).toEqual([
      { name: "User", parts: [] },
      { name: "FOLLOWS", parts: ["User", "User"] },
    ]);
  });

  test.each(dataModels)("an empty %s structure has nothing to show", (model) => {
    expect(summarizeStructure(emptyStructure(model))).toEqual([]);
  });
});
