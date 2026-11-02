import { boundaryKinds } from "./boundaryKinds";
import { type ComponentKind, componentKindNames, describeOptions, getKindDefinition } from "./componentKinds";
import { structureToText } from "./databaseStructure";
import type { Connection, Diagram, DiagramObject } from "./schema";
import { expectedValue } from "./validate";

const quoted = (text: string) => JSON.stringify(text);

export const nameOf = (object: DiagramObject) =>
  object.type === "component" || object.type === "boundary" ? object.name : object.text;

export function whatOf(object: DiagramObject): string {
  if (object.type === "component") return getKindDefinition(object.kind).label;
  if (object.type === "boundary") return `${object.kind ? `${boundaryKinds[object.kind].label} ` : ""}boundary`;
  return object.type === "text" ? "note" : object.type;
}

function describeObject(object: DiagramObject): string[] {
  if (object.type === "text") {
    return [`- [${object.id}] note ${quoted(object.text)}${object.parent ? `. Inside [${object.parent}]` : ""}`];
  }

  const facts = [
    object.parent ? `Inside [${object.parent}]` : undefined,
    object.description,
    object.tags?.length ? `Tags: ${object.tags.join(", ")}` : undefined,
    ...(object.type === "component" ? describeOptions(object.kind, object.options) : []),
  ].filter(Boolean);
  const lines = [
    `- [${object.id}] ${quoted(nameOf(object))} (${whatOf(object)})${facts.length ? `. ${facts.join(". ")}` : ""}`,
  ];
  if (object.type === "component" && object.structure) {
    lines.push(...structureToText(object.structure).map((line) => `  ${line}`));
  }
  return lines;
}

function describeConnection({ id, from, to, label, direction, line }: Connection): string {
  const arrow = { forward: "->", backward: "<-", both: "<->", none: "--" }[direction];
  const extras = [label ? quoted(label) : undefined, line === "solid" ? undefined : line].filter(Boolean);
  return `- [${id}] [${from}] ${arrow} [${to}]${extras.length ? ` ${extras.join(" ")}` : ""}`;
}

export function describeDiagram(diagram: Diagram): string {
  const sections = [
    ["Boundaries", diagram.objects.filter((object) => object.type === "boundary").flatMap(describeObject)],
    ["Components", diagram.objects.filter((object) => object.type === "component").flatMap(describeObject)],
    [
      "Shapes",
      diagram.objects
        .filter((object) => object.type === "rectangle" || object.type === "sphere")
        .flatMap(describeObject),
    ],
    ["Notes", diagram.objects.filter((object) => object.type === "text").flatMap(describeObject)],
    ["Connections", diagram.connections.map(describeConnection)],
  ] as const;
  return sections
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}:\n${lines.join("\n")}`)
    .join("\n\n");
}

function describeKind(kind: ComponentKind): string[] {
  const { label, description, options } = getKindDefinition(kind);
  return [
    `- ${kind} (${label}): ${description}${options.length ? " Options:" : " No options."}`,
    ...options.map(({ key, description, showWhen, ...option }) => {
      const when = showWhen ? ` Only when "${showWhen.key}" is one of: ${showWhen.is.join(", ")}.` : "";
      return `  - ${key}: ${expectedValue({ key, description, ...option })}. ${description}${when}`;
    }),
  ];
}

export function describeKinds(): string {
  const lines = componentKindNames.flatMap(describeKind);
  const boundaries = Object.entries(boundaryKinds).map(([kind, { description }]) => `- ${kind}: ${description}`);
  return `Component kinds:\n${lines.join("\n")}\n\nBoundary kinds (optional):\n${boundaries.join("\n")}`;
}
