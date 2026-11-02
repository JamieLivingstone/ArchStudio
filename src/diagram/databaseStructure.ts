import { z } from "zod";

const name = z.string();
const optional = z.string().optional();
const names = z.array(z.string());

const relational = z.object({
  model: z.literal("Relational"),
  tables: z.array(
    z.object({
      name,
      columns: z.array(
        z.object({
          name,
          type: optional,
          primaryKey: z.boolean().optional(),
          /** The column it refers to, as "table.column". */
          references: optional,
        }),
      ),
      partitionKey: optional,
    }),
  ),
});

const keyValue = z.object({
  model: z.literal("Key-value"),
  patterns: z.array(z.object({ name: optional, key: z.string(), value: optional, ttl: optional })),
});

const document = z.object({
  model: z.literal("Document"),
  collections: z.array(z.object({ name, id: optional, fields: names, nested: optional })),
});

const wideColumn = z.object({
  model: z.literal("Wide-column"),
  tables: z.array(z.object({ name, partitionKey: z.string(), sortKey: optional, columns: names })),
});

const graph = z.object({
  model: z.literal("Graph"),
  nodeTypes: names,
  relationships: z.array(z.object({ name, from: optional, to: optional })),
});

const timeSeries = z.object({
  model: z.literal("Time-series"),
  series: z.array(z.object({ name, timestamp: optional, dimensions: names, values: names, retention: optional })),
});

const vector = z.object({
  model: z.literal("Vector"),
  collections: z.array(z.object({ name, id: optional, metadata: names, filterable: names, source: optional })),
});

const other = z.object({ model: z.literal("Other"), description: z.string() });

export const databaseStructureSchema = z.discriminatedUnion("model", [
  relational,
  keyValue,
  document,
  wideColumn,
  graph,
  timeSeries,
  vector,
  other,
]);

export type DatabaseStructure = z.infer<typeof databaseStructureSchema>;
type DataModel = DatabaseStructure["model"];
export type StructureOf<M extends DataModel> = Extract<DatabaseStructure, { model: M }>;

export const dataModels = [
  "Relational",
  "Document",
  "Key-value",
  "Wide-column",
  "Graph",
  "Time-series",
  "Vector",
  "Other",
] as const satisfies readonly DataModel[];

export const structureLabels: Record<DataModel, string> = {
  Relational: "Tables",
  "Key-value": "Key/value structure",
  Document: "Collections",
  "Wide-column": "Tables / column families",
  Graph: "Graph model",
  "Time-series": "Series structure",
  Vector: "Collection structure",
  Other: "Data structure",
};

export const isDataModel = (value: unknown): value is DataModel => dataModels.includes(value as DataModel);

export function emptyStructure(model: DataModel): DatabaseStructure {
  switch (model) {
    case "Relational":
      return { model, tables: [] };
    case "Key-value":
      return { model, patterns: [] };
    case "Document":
      return { model, collections: [] };
    case "Wide-column":
      return { model, tables: [] };
    case "Graph":
      return { model, nodeTypes: [], relationships: [] };
    case "Time-series":
      return { model, series: [] };
    case "Vector":
      return { model, collections: [] };
    case "Other":
      return { model, description: "" };
  }
}

export function describeStructureSize(structure: DatabaseStructure): string {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
  switch (structure.model) {
    case "Relational":
    case "Wide-column":
      return plural(structure.tables.length, "table");
    case "Key-value":
      return plural(structure.patterns.length, "key pattern");
    case "Document":
    case "Vector":
      return plural(structure.collections.length, "collection");
    case "Graph":
      return `${plural(structure.nodeTypes.length, "node type")} and ${plural(structure.relationships.length, "relationship")}`;
    case "Time-series":
      return `${structure.series.length} series`;
    case "Other":
      return "its description";
  }
}

const list = (items: string[]) => items.filter((item) => item.trim()).join(", ");
const part = (label: string, value: string | undefined) => (value?.trim() ? `${label} ${value.trim()}` : undefined);
const joined = (parts: (string | undefined)[]) => parts.filter(Boolean).join("; ");

export function summarizeStructure(structure: DatabaseStructure): { name: string; parts: string[] }[] {
  const filled = (items: (string | undefined)[]) => items.flatMap((item) => (item?.trim() ? [item.trim()] : []));
  const entries = () => {
    switch (structure.model) {
      case "Relational":
        return structure.tables.map((table) => ({
          name: table.name,
          parts: filled(table.columns.map((column) => column.name)),
        }));
      case "Key-value":
        return structure.patterns.map((pattern) => ({
          name: pattern.name?.trim() || pattern.key,
          parts: filled([pattern.name?.trim() ? pattern.key : undefined, pattern.value]),
        }));
      case "Document":
        return structure.collections.map(({ name, fields }) => ({ name, parts: filled(fields) }));
      case "Wide-column":
        return structure.tables.map((table) => ({
          name: table.name,
          parts: filled([table.partitionKey, table.sortKey, ...table.columns]),
        }));
      case "Graph":
        return [
          ...structure.nodeTypes.map((name) => ({ name, parts: [] })),
          ...structure.relationships.map(({ name, from, to }) => ({ name, parts: filled([from, to]) })),
        ];
      case "Time-series":
        return structure.series.map((series) => ({
          name: series.name,
          parts: filled([...series.dimensions, ...series.values]),
        }));
      case "Vector":
        return structure.collections.map(({ name, metadata }) => ({ name, parts: filled(metadata) }));
      case "Other":
        return [{ name: structure.description, parts: [] }];
    }
  };
  return entries()
    .map(({ name, parts }) => ({ name: name.trim(), parts }))
    .filter(({ name, parts }) => name || parts.length > 0);
}

export function structureToText(structure: DatabaseStructure): string[] {
  switch (structure.model) {
    case "Relational":
      return structure.tables.map((table) => {
        const columns = table.columns
          .filter((column) => column.name.trim())
          .map((column) =>
            [
              column.name,
              column.type?.trim(),
              column.primaryKey ? "PK" : undefined,
              column.references?.trim() ? `-> ${column.references.trim()}` : undefined,
            ]
              .filter(Boolean)
              .join(" "),
          );
        const key = table.partitionKey?.trim() ? `, partitioned by ${table.partitionKey.trim()}` : "";
        return `table ${table.name}(${columns.join(", ")})${key}`;
      });
    case "Key-value":
      return structure.patterns.map((pattern) =>
        joined([pattern.name?.trim(), `key ${pattern.key}`, part("value", pattern.value), part("ttl", pattern.ttl)]),
      );
    case "Document":
      return structure.collections.map((collection) =>
        joined([
          `collection ${collection.name}`,
          part("id", collection.id),
          part("fields", list(collection.fields)),
          part("nested", collection.nested),
        ]),
      );
    case "Wide-column":
      return structure.tables.map((table) =>
        joined([
          `table ${table.name}`,
          part("partition key", table.partitionKey),
          part("sort key", table.sortKey),
          part("columns", list(table.columns)),
        ]),
      );
    case "Graph":
      return [
        joined([part("node types", list(structure.nodeTypes))]),
        ...structure.relationships.map((relationship) =>
          [relationship.from?.trim(), `-[${relationship.name}]->`, relationship.to?.trim()].filter(Boolean).join(" "),
        ),
      ].filter(Boolean);
    case "Time-series":
      return structure.series.map((series) =>
        joined([
          `series ${series.name}`,
          part("timestamp", series.timestamp),
          part("dimensions", list(series.dimensions)),
          part("values", list(series.values)),
          part("retention", series.retention),
        ]),
      );
    case "Vector":
      return structure.collections.map((collection) =>
        joined([
          `collection ${collection.name}`,
          part("id", collection.id),
          part("metadata", list(collection.metadata)),
          part("filterable", list(collection.filterable)),
          part("source", collection.source),
        ]),
      );
    case "Other":
      return structure.description.trim() ? [structure.description.trim()] : [];
  }
}
