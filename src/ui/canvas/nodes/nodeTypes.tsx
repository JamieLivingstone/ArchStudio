import type { Node, NodeProps, NodeTypes } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { type BoundaryKind, boundaryKinds } from "../../../diagram/boundaryKinds";
import { type ComponentKind, type OptionValue, summarizeOptions } from "../../../diagram/componentKinds";
import { type DatabaseStructure, summarizeStructure } from "../../../diagram/databaseStructure";
import { iconFor, iconNamed } from "../../icons";
import { boundaryIcon, unnamedBoundary } from "../toolbar/boundaryCatalog";
import { getComponentDefinition } from "../toolbar/componentCatalog";
import { BaseNode } from "./BaseNode";
import { DetailInfo } from "./DetailInfo";
import { InlineLabel } from "./InlineLabel";
import { MIN_SPHERE_DIAMETER } from "./sizes";

type TextNodeType = Node<{ label: string }, "text">;
type Annotations = { description?: string; tags?: string[]; icon?: string };
type RectangleNodeType = Node<{ label: string } & Annotations, "rectangle">;
type SphereNodeType = Node<{ label: string; diameter?: number } & Omit<Annotations, "tags">, "sphere">;
type ComponentNodeType = Node<
  {
    label: string;
    kind: ComponentKind;
    options?: Record<string, OptionValue>;
    structure?: DatabaseStructure;
  } & Annotations,
  "component"
>;

type BoundaryNodeType = Node<{ label: string; kind?: BoundaryKind; empty?: boolean } & Annotations, "boundary">;

export type CanvasNode = TextNodeType | RectangleNodeType | SphereNodeType | ComponentNodeType | BoundaryNodeType;

function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  return (
    <BaseNode selected={selected} connectable={false} className="rounded px-1 text-sm text-fg">
      <InlineLabel id={id} label={data.label} placeholder="Text" />
    </BaseNode>
  );
}

function IconTile({ icon: Icon, tone = "bg-accent/10 text-accent" }: { icon: LucideIcon; tone?: string }) {
  return (
    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={16} />
    </span>
  );
}

function Description({
  id,
  text,
  align = "start",
}: {
  id: string;
  text: string | undefined;
  align?: "start" | "center";
}) {
  if (!text) return null;
  return (
    <div data-description="" className="text-xs leading-snug text-muted">
      <InlineLabel id={id} field="description" label={text} align={align} className="[&>span]:line-clamp-3" />
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Tags" className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
          {tag}
        </li>
      ))}
    </ul>
  );
}

const shapeClass = "border border-line bg-surface text-sm text-fg shadow-sm";
const centred = "flex items-center justify-center text-center";

function RectangleNode({ id, data, selected, width }: NodeProps<RectangleNodeType>) {
  const Icon = iconNamed(data.icon);
  const tags = data.tags ?? [];
  const plain = !Icon && !data.description && tags.length === 0;
  const fitted = !plain && width === undefined;

  return (
    <BaseNode
      selected={selected}
      resizable={{ minWidth: 80, minHeight: 48 }}
      className={`${shapeClass} rounded-lg ${fitted ? "w-56" : "size-full overflow-hidden"} ${plain ? centred : ""}`}
    >
      {plain ? (
        <InlineLabel id={id} label={data.label} className="p-3" />
      ) : (
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-center gap-3">
            {Icon && <IconTile icon={Icon} />}
            <div className="min-w-0 flex-1 font-medium">
              <InlineLabel id={id} label={data.label} placeholder="Untitled" align="start" />
            </div>
          </div>
          <Description id={id} text={data.description} />
          <Tags tags={tags} />
        </div>
      )}
    </BaseNode>
  );
}

const SPHERE_GROWTH_STEP = 8;

function SphereNode({ id, data, selected, width }: NodeProps<SphereNodeType>) {
  const Icon = iconNamed(data.icon);
  const content = [data.label, data.description, data.icon].join("\n");
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ content, diameter: MIN_SPHERE_DIAMETER });
  const fitted = fit.content === content ? fit.diameter : MIN_SPHERE_DIAMETER;
  const [resizing, setResizing] = useState(false);
  const chosen = resizing ? width : data.diameter;
  const diameter = Math.max(chosen ?? 0, fitted);
  const side = diameter / Math.SQRT2 - 8;

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const overflows = element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    if (overflows) setFit({ content, diameter: diameter + SPHERE_GROWTH_STEP });
  }, [content, diameter]);

  return (
    <BaseNode
      selected={selected}
      resizable={{
        minWidth: fitted,
        minHeight: fitted,
        keepAspectRatio: true,
        onResizeStart: () => setResizing(true),
        onResizeEnd: () => setResizing(false),
      }}
      className={`${shapeClass} ${centred} rounded-full`}
      style={{ width: diameter, height: diameter }}
    >
      <div
        ref={contentRef}
        style={{ width: side, height: side }}
        className="flex flex-col items-center justify-center gap-1.5"
      >
        {Icon && <IconTile icon={Icon} />}
        <InlineLabel id={id} label={data.label} />
        <Description id={id} text={data.description} align="center" />
      </div>
    </BaseNode>
  );
}

const wraps = "w-0 min-w-full empty:hidden";

function ComponentNode({ id, data, selected }: NodeProps<ComponentNodeType>) {
  const definition = getComponentDefinition(data.kind);
  const settings = summarizeOptions(definition.options, data.options ?? {});
  const tags = data.tags ?? [];
  const structure = data.structure ? summarizeStructure(data.structure) : [];

  return (
    // `w-0` on what wraps leaves only the details deciding the width.
    <BaseNode selected={selected} className="w-max min-w-56 rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <IconTile icon={iconFor(data.icon, definition.icon)} tone={definition.tone} />
        <div className="w-0 flex-1">
          <div className="text-sm font-medium text-fg">
            <InlineLabel id={id} label={data.label} placeholder="Untitled" align="start" />
          </div>
          <p className="truncate text-xs text-muted">{definition.label}</p>
        </div>
      </div>

      {(data.description || settings.length > 0 || structure.length > 0 || tags.length > 0) && (
        <div className="flex flex-col gap-1.5 px-3 pt-0.5 pb-2.5">
          <div className={wraps}>
            <Description id={id} text={data.description} />
          </div>
          {settings.length > 0 && (
            <dl className="-mx-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 rounded-lg bg-hover/70 px-2 py-1.5 text-xs leading-snug whitespace-nowrap">
              {settings.map(({ option, label, value }) => (
                <Fragment key={option.key}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="flex items-center justify-end gap-1 text-fg/80">
                    <span>{value}</span>
                    <DetailInfo option={option} value={value} />
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
          {structure.length > 0 && (
            <ul
              aria-label="Structure"
              className="-mx-1 flex w-0 min-w-[calc(100%+0.5rem)] flex-col gap-0.5 rounded-lg bg-hover/70 px-2 py-1.5 text-xs leading-snug [overflow-wrap:anywhere]"
            >
              {structure.map(({ name, parts }) => (
                <li key={`${name} ${parts.join(" ")}`}>
                  <span className="font-medium text-fg/80">{name}</span>
                  {parts.length > 0 && <span className="text-muted"> {parts.join(", ")}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className={wraps}>
            <Tags tags={tags} />
          </div>
        </div>
      )}
    </BaseNode>
  );
}

function BoundaryNode({ id, data, selected }: NodeProps<BoundaryNodeType>) {
  const Icon = iconFor(data.icon, boundaryIcon(data.kind));
  return (
    <BaseNode
      selected={selected}
      resizable={{ minWidth: 160, minHeight: 100 }}
      className={`boundary-frame relative size-full rounded-2xl border bg-accent/[0.03] transition-colors ${
        data.kind === "trustZone" ? "border-dashed border-muted/60" : "border-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Icon size={15} strokeWidth={1.75} className="shrink-0 text-accent" />
        <div className="min-w-0 text-[13px] font-medium text-fg">
          <InlineLabel id={id} label={data.label} placeholder={unnamedBoundary(data.kind)} align="start" />
        </div>
        {data.kind && <span className="shrink-0 text-xs text-muted">{boundaryKinds[data.kind].label}</span>}
      </div>
      <div className="px-3.5 pt-0.5">
        <Description id={id} text={data.description} />
      </div>
      {data.empty && (
        <p className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-xs leading-relaxed text-muted">
          Drag things in, or select this boundary and add from the sidebar
        </p>
      )}
    </BaseNode>
  );
}

export const nodeTypes: NodeTypes = {
  text: TextNode,
  rectangle: RectangleNode,
  sphere: SphereNode,
  component: ComponentNode,
  boundary: BoundaryNode,
};
