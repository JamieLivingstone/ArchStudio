import { KeyRound, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { DatabaseStructure, StructureOf } from "../../diagram/databaseStructure";
import { TagEditor } from "./TagEditor";

const input =
  "min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-fg outline-none transition-colors placeholder:text-muted/70 hover:border-line focus:border-accent focus:bg-surface";

const optional = (text: string) => text || undefined;

function Text({
  label,
  value,
  placeholder,
  onChange,
  className = "",
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <input
      aria-label={label}
      value={value ?? ""}
      placeholder={placeholder ?? label}
      onChange={(event) => onChange(event.target.value)}
      className={`${input} ${className}`}
    />
  );
}

function Names({ label, names, onChange }: { label: string; names: string[]; onChange: (names: string[]) => void }) {
  return (
    <div>
      <span className="block px-1.5 pt-1 pb-0.5 text-[11px] text-muted">{label}</span>
      <TagEditor tags={names} onChange={onChange} noun={label.toLowerCase().replace(/s$/, "")} />
    </div>
  );
}

const remove = (reveal: string) =>
  `shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-hover hover:text-fg focus:opacity-100 ${reveal}`;

function AddButton({ noun, onClick }: { noun: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-hover hover:text-fg"
    >
      <Plus size={12} />
      Add {noun}
    </button>
  );
}

function useFocusNewest() {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    ref.current?.lastElementChild?.querySelector("input")?.focus();
    setPending(false);
  }, [pending]);
  return [ref, () => setPending(true)] as const;
}

function Items<T>({
  noun,
  items,
  onChange,
  blank,
  children,
}: {
  noun: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  children: (item: T, update: (changes: Partial<T>) => void) => ReactNode;
}) {
  const [list, focusNewest] = useFocusNewest();
  return (
    <div className="flex flex-col gap-1.5">
      <div ref={list} className="flex flex-col gap-1.5 empty:hidden">
        {items.map((item, index) => (
          <fieldset
            // biome-ignore lint/suspicious/noArrayIndexKey: items have no ids; their position is their identity while editing
            key={index}
            aria-label={`${noun} ${index + 1}`}
            className="group/item relative min-w-0 rounded-lg bg-hover/60 p-1.5"
          >
            <button
              type="button"
              aria-label={`Remove ${noun} ${index + 1}`}
              onClick={() => onChange(items.filter((_, other) => other !== index))}
              className={`absolute top-1.5 right-1.5 ${remove("group-hover/item:opacity-100")}`}
            >
              <X size={12} />
            </button>
            <div className="flex flex-col gap-0.5 [&>:first-child]:mr-5">
              {children(item, (changes) =>
                onChange(items.map((other, at) => (at === index ? { ...other, ...changes } : other))),
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <AddButton
        noun={noun}
        onClick={() => {
          onChange([...items, blank]);
          focusNewest();
        }}
      />
    </div>
  );
}

type Editor<M extends DatabaseStructure["model"]> = {
  structure: StructureOf<M>;
  onChange: (structure: StructureOf<M>) => void;
};

type Column = StructureOf<"Relational">["tables"][number]["columns"][number];

function Columns({ columns, onChange }: { columns: Column[]; onChange: (columns: Column[]) => void }) {
  const [list, focusNewest] = useFocusNewest();
  return (
    <>
      <div ref={list} className="flex flex-col empty:hidden">
        {columns.map((column, index) => {
          const change = (changes: Partial<Column>) =>
            onChange(columns.map((other, at) => (at === index ? { ...other, ...changes } : other)));
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: columns have no ids; their position is their identity
            <div key={index} className="group/column flex items-center gap-0.5 font-mono">
              <Text
                label="Column name"
                value={column.name}
                placeholder="column"
                onChange={(name) => change({ name })}
                className="flex-1"
              />
              <Text
                label="Type"
                value={column.type}
                placeholder="type"
                onChange={(type) => change({ type: optional(type) })}
                className="w-14 shrink-0"
              />
              <Text
                label="References"
                value={column.references}
                placeholder="→ ref"
                onChange={(references) => change({ references: optional(references) })}
                className="w-14 shrink-0"
              />
              <button
                type="button"
                aria-label="Primary key"
                aria-pressed={column.primaryKey === true}
                title="Primary key"
                onClick={() => change({ primaryKey: column.primaryKey ? undefined : true })}
                className={`shrink-0 rounded p-1 transition-colors ${column.primaryKey ? "text-accent" : "text-muted/50 hover:text-fg"}`}
              >
                <KeyRound size={12} />
              </button>
              <button
                type="button"
                aria-label={`Remove column ${index + 1}`}
                onClick={() => onChange(columns.filter((_, other) => other !== index))}
                className={remove("group-hover/column:opacity-100")}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <AddButton
        noun="column"
        onClick={() => {
          onChange([...columns, { name: "" }]);
          focusNewest();
        }}
      />
    </>
  );
}

function RelationalEditor({ structure, onChange }: Editor<"Relational">) {
  return (
    <Items
      noun="table"
      items={structure.tables}
      blank={{ name: "", columns: [] }}
      onChange={(tables) => onChange({ ...structure, tables })}
    >
      {(table, update) => {
        return (
          <>
            <Text
              label="Table name"
              value={table.name}
              placeholder="Table name, e.g. orders"
              onChange={(name) => update({ name })}
              className="font-medium"
            />
            <Columns columns={table.columns} onChange={(columns) => update({ columns })} />
            <Text
              label="Partition key"
              value={table.partitionKey}
              placeholder="Partition / shard key (optional)"
              onChange={(partitionKey) => update({ partitionKey: optional(partitionKey) })}
            />
          </>
        );
      }}
    </Items>
  );
}

function GraphEditor({ structure, onChange }: Editor<"Graph">) {
  return (
    <div className="flex flex-col gap-2">
      <Names
        label="Node types"
        names={structure.nodeTypes}
        onChange={(nodeTypes) => onChange({ ...structure, nodeTypes })}
      />
      <span className="text-[11px] text-muted">Relationships</span>
      <Items
        noun="relationship"
        items={structure.relationships}
        blank={{ name: "" }}
        onChange={(relationships) => onChange({ ...structure, relationships })}
      >
        {(relationship, update) => (
          <div className="flex items-center gap-1">
            <Text
              label="From"
              value={relationship.from}
              placeholder="From"
              onChange={(from) => update({ from: optional(from) })}
              className="flex-1"
            />
            <Text
              label="Relationship"
              value={relationship.name}
              placeholder="FOLLOWS"
              onChange={(name) => update({ name })}
              className="flex-1 font-mono"
            />
            <Text
              label="To"
              value={relationship.to}
              placeholder="To"
              onChange={(to) => update({ to: optional(to) })}
              className="flex-1"
            />
          </div>
        )}
      </Items>
    </div>
  );
}

type ListModel = "Key-value" | "Document" | "Wide-column" | "Time-series" | "Vector";
type ListOf<M extends ListModel> = Exclude<keyof StructureOf<M>, "model">;
type ItemOf<M extends ListModel> = StructureOf<M>[ListOf<M>] extends (infer I)[] ? I : never;

interface Field<K extends string = string> {
  key: K;
  label: string;
  placeholder?: string;
  required?: true;
  names?: true;
  className?: string;
}

const text = <K extends string>(key: K, label: string, placeholder: string): Field<K> => ({ key, label, placeholder });
const required = <K extends string>(key: K, label: string, placeholder: string, className?: string): Field<K> => ({
  ...text(key, label, placeholder),
  required: true,
  className,
});
const names = <K extends string>(key: K, label: string): Field<K> => ({ key, label, names: true });

const itemLists: {
  [M in ListModel]: { list: ListOf<M>; noun: string; fields: Field<keyof ItemOf<M> & string>[] };
} = {
  "Key-value": {
    list: "patterns",
    noun: "key pattern",
    fields: [
      text("name", "Name", "Name, e.g. Session (optional)"),
      required("key", "Key", "Key, e.g. session:{session_id}", "font-mono"),
      text("value", "Value", "Value, e.g. user_id, permissions"),
      text("ttl", "TTL", "TTL, e.g. 30m (optional)"),
    ],
  },
  Document: {
    list: "collections",
    noun: "collection",
    fields: [
      required("name", "Collection name", "Collection, e.g. users", "font-medium"),
      text("id", "Document ID", "Document ID, e.g. _id"),
      names("fields", "Fields"),
      text("nested", "Nested", "Embedded data, e.g. addresses inside each user (optional)"),
    ],
  },
  "Wide-column": {
    list: "tables",
    noun: "table",
    fields: [
      required("name", "Table name", "Table / column family", "font-medium"),
      required("partitionKey", "Partition key", "Partition key, e.g. user_id"),
      text("sortKey", "Sort key", "Clustering / sort key (optional)"),
      names("columns", "Columns"),
    ],
  },
  "Time-series": {
    list: "series",
    noun: "series",
    fields: [
      required("name", "Series name", "Measurement, e.g. cpu_usage", "font-medium"),
      text("timestamp", "Timestamp", "Timestamp field, e.g. timestamp"),
      names("dimensions", "Dimensions"),
      names("values", "Values"),
      text("retention", "Retention", "Retention, e.g. 30d (optional)"),
    ],
  },
  Vector: {
    list: "collections",
    noun: "collection",
    fields: [
      required("name", "Collection name", "Collection / index, e.g. property_embeddings", "font-medium"),
      text("id", "ID", "ID / key, e.g. id"),
      names("metadata", "Metadata"),
      names("filterable", "Filterable"),
      text("source", "Source", "What is embedded, e.g. listing descriptions (optional)"),
    ],
  },
};

type Item = Record<string, string | string[] | undefined>;

function ItemList({
  noun,
  fields,
  items,
  onChange,
}: {
  noun: string;
  fields: Field[];
  items: Item[];
  onChange: (items: Item[]) => void;
}) {
  const blank: Item = {};
  for (const field of fields) {
    if (field.names) blank[field.key] = [];
    else if (field.required) blank[field.key] = "";
  }
  return (
    <Items noun={noun} items={items} blank={blank} onChange={onChange}>
      {(item, update) =>
        fields.map((field) =>
          field.names ? (
            <Names
              key={field.key}
              label={field.label}
              names={item[field.key] as string[]}
              onChange={(next) => update({ [field.key]: next })}
            />
          ) : (
            <Text
              key={field.key}
              label={field.label}
              value={item[field.key] as string | undefined}
              placeholder={field.placeholder}
              onChange={(value) => update({ [field.key]: field.required ? value : optional(value) })}
              className={field.className}
            />
          ),
        )
      }
    </Items>
  );
}

export function StructureEditor({
  structure,
  onChange,
}: {
  structure: DatabaseStructure;
  onChange: (structure: DatabaseStructure) => void;
}) {
  switch (structure.model) {
    case "Relational":
      return <RelationalEditor structure={structure} onChange={onChange} />;
    case "Graph":
      return <GraphEditor structure={structure} onChange={onChange} />;
    case "Other":
      return (
        <textarea
          aria-label="Data structure"
          rows={3}
          value={structure.description}
          placeholder="How the data is organised"
          onChange={(event) => onChange({ ...structure, description: event.target.value })}
          className={`${input} resize-none`}
        />
      );
    default: {
      const { list, noun, fields } = itemLists[structure.model];
      // The table names each model's own list, which the types cannot follow.
      const items = (structure as unknown as Record<string, Item[]>)[list];
      return (
        <ItemList
          noun={noun}
          fields={fields}
          items={items}
          onChange={(next) => onChange({ ...structure, [list]: next } as DatabaseStructure)}
        />
      );
    }
  }
}
