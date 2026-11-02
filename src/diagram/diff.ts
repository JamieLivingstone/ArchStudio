import { getKindDefinition, summarizeOptions } from "./componentKinds";
import { structureToText } from "./databaseStructure";
import { nameOf, whatOf } from "./describe";
import type { Connection, Diagram, DiagramObject } from "./schema";

interface FieldChange {
  label: string;
  before?: string;
  after?: string;
}

export interface DiagramChange {
  target: "object" | "connection";
  id: string;
  change: "added" | "removed" | "changed" | "moved";
  title: string;
  what: string;
  fields: FieldChange[];
}

// `comparedBy` is for values that read alike but differ: two boundaries of the same name, a list of tags.
type Facts = [label: string, value: string | undefined, comparedBy?: string][];
type Described = { title: string; what: string; facts: Facts };

function describeObject(object: DiagramObject, diagram: Diagram): Described {
  const inside = diagram.objects.find((candidate) => candidate.id === object.parent);
  const facts: Facts = [
    [object.type === "text" ? "Text" : "Name", nameOf(object)],
    ["Kind", whatOf(object)],
    ["Inside", inside && nameOf(inside), object.parent],
  ];
  if (object.type !== "text") {
    const tags = object.tags?.length ? object.tags : undefined;
    facts.push(["Description", object.description], ["Tags", tags?.join(", "), tags && JSON.stringify(tags)]);
    facts.push(["Icon", object.icon]);
  }
  if (object.type === "component") {
    for (const { label, value } of summarizeOptions(getKindDefinition(object.kind).options, object.options)) {
      facts.push([label, value]);
    }
    if (object.structure) {
      const text = structureToText(object.structure).join("\n") || undefined;
      facts.push(["Structure", text, text && JSON.stringify(object.structure)]);
    }
  }
  return { title: nameOf(object).trim() || "Untitled", what: whatOf(object), facts };
}

function describeConnection({ from, to, label, direction, line }: Connection, diagram: Diagram): Described {
  const name = (id: string) => {
    const object = diagram.objects.find((candidate) => candidate.id === id);
    return (object && nameOf(object).trim()) || id;
  };
  return {
    title: `${name(from)} → ${name(to)}`,
    what: "connection",
    facts: [
      ["Label", label || undefined],
      ["Direction", direction],
      ["Line", line],
    ],
  };
}

function changedFields(before: Facts, after: Facts): FieldChange[] {
  const byLabel = (facts: Facts) => new Map(facts.map(([label, value, comparedBy]) => [label, { value, comparedBy }]));
  const [was, now] = [byLabel(before), byLabel(after)];
  const labels = new Set([...after, ...before].map(([label]) => label));
  return [...labels].flatMap((label) => {
    const [old, current] = [was.get(label), now.get(label)];
    const same = (old?.comparedBy ?? old?.value) === (current?.comparedBy ?? current?.value);
    return same ? [] : [{ label, before: old?.value, after: current?.value }];
  });
}

const inTitle = new Set(["Name", "Text", "Kind"]);
const connectionDefaults: Record<string, string> = { Direction: "forward", Line: "solid" };
const beyondTitle = (fields: FieldChange[]) =>
  fields.filter(({ label, before, after }) => !inTitle.has(label) && connectionDefaults[label] !== (after ?? before));

function compare<T extends { id: string }>(
  target: DiagramChange["target"],
  before: Diagram,
  after: Diagram,
  items: (diagram: Diagram) => T[],
  describe: (item: T, diagram: Diagram) => Described,
  key: (item: T) => string,
  moved: (was: T, now: T) => boolean,
): DiagramChange[] {
  const earlier = new Map(items(before).map((item) => [key(item), item]));
  const later = new Set(items(after).map(key));
  const changes: DiagramChange[] = [];
  for (const item of items(after)) {
    const { title, what, facts } = describe(item, after);
    const was = earlier.get(key(item));
    const fields = changedFields(was ? describe(was, before).facts : [], facts);
    if (!was) changes.push({ target, id: item.id, change: "added", title, what, fields: beyondTitle(fields) });
    else if (fields.length > 0) changes.push({ target, id: item.id, change: "changed", title, what, fields });
    else if (moved(was, item)) changes.push({ target, id: item.id, change: "moved", title, what, fields: [] });
  }
  for (const item of items(before)) {
    if (later.has(key(item))) continue;
    const { title, what, facts } = describe(item, before);
    const fields = beyondTitle(changedFields(facts, []));
    changes.push({ target, id: item.id, change: "removed", title, what, fields });
  }
  return changes;
}

const placement = (object: DiagramObject) => JSON.stringify([object.position, "size" in object && object.size]);

export function diffDiagrams(before: Diagram, after: Diagram): DiagramChange[] {
  return [
    ...compare(
      "object",
      before,
      after,
      (diagram) => diagram.objects,
      describeObject,
      (object) => object.id,
      (was, now) => placement(was) !== placement(now),
    ),
    ...compare(
      "connection",
      before,
      after,
      (diagram) => diagram.connections,
      describeConnection,
      ({ id, from, to }) => JSON.stringify([id, from, to]),
      () => false,
    ),
  ];
}
