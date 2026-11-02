import type { ElkNode } from "elkjs/lib/elk-api";
import type { Position, Size } from "../../../diagram/schema";
import { BOUNDARY_HEADER, BOUNDARY_MARGIN } from "../nodes/sizes";

interface LayoutBox {
  id: string;
  width: number;
  height: number;
  parent?: string;
  group?: boolean;
  header?: number;
  x?: number;
}

const groupPadding = (header = BOUNDARY_HEADER) =>
  `[top=${header},left=${BOUNDARY_MARGIN},bottom=${BOUNDARY_MARGIN},right=${BOUNDARY_MARGIN}]`;
const BETWEEN_COLUMNS = 72;

interface LayoutLink {
  from: string;
  to: string;
  label?: string;
}

const IN = ":in";
const OUT = ":out";

const LABEL_MARGIN = 32;

export const labelWidth = (label: string) => Math.ceil(label.length * 7) + 16;

const options = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "56",
  "elk.spacing.componentComponent": "48",
  "elk.spacing.edgeNode": "40",
  "elk.layered.layering.strategy": "LONGEST_PATH_SOURCE",
  // Lines run straight wherever they can. Centring a node between the several it connects to was
  // tried first, and left almost every line with a small step in it.
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
};

// ELK crashes when this is combined with groups, so it is only used without them.
const keepDrawnOrder = { "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES" };

export interface Layout {
  positions: Map<string, Position>;
  sizes: Map<string, Size>;
}

const loadElk = () => import("elkjs/lib/elk.bundled.js");
export const preloadLayout = () => void loadElk();

export async function layout(boxes: LayoutBox[], links: LayoutLink[], origin: Position): Promise<Layout> {
  const { default: ELK } = await loadElk();
  const ids = new Set(boxes.map((box) => box.id));
  const valid = links.filter(({ from, to }) => from !== to && ids.has(from) && ids.has(to));
  const parentOf = (id: string) => {
    const parent = boxes.find((box) => box.id === id)?.parent;
    return parent && ids.has(parent) ? parent : undefined;
  };
  const inside = (container: string | undefined) => boxes.filter((box) => parentOf(box.id) === container);

  const childOf = (container: string | undefined, id: string): string | undefined => {
    for (let current: string | undefined = id; current; current = parentOf(current)) {
      if (parentOf(current) === container) return current;
    }
    return undefined;
  };
  const widestLabel = Math.max(0, ...valid.map(({ label }) => (label ? labelWidth(label) + 2 * LABEL_MARGIN : 0)));
  const spaced = {
    ...options,
    "elk.layered.spacing.nodeNodeBetweenLayers": String(Math.max(BETWEEN_COLUMNS, widestLabel)),
  };

  const hasContents = (id: string) => inside(id).length > 0;

  const toElk = (box: LayoutBox): ElkNode => {
    const children = box.group ? inside(box.id) : [];
    return {
      id: box.id,
      width: box.width,
      height: box.height,
      ...(children.length > 0
        ? { children: children.map(toElk), layoutOptions: { ...spaced, "elk.padding": groupPadding(box.header) } }
        : {
            // Left to itself ELK spreads lines along each side, which puts a kink in lines that should run straight.
            layoutOptions: { "elk.portConstraints": "FIXED_POS" },
            ports: [
              { id: `${box.id}${IN}`, x: 0, y: box.height / 2, width: 0, height: 0 },
              { id: `${box.id}${OUT}`, x: box.width, y: box.height / 2, width: 0, height: 0 },
            ],
          }),
    };
  };

  // ELK stacks unconnected things in one column; these links, never drawn, keep them in a row as they were placed.
  const looseIn = new Map<string | undefined, Set<string>>();
  const ordering = [undefined, ...boxes.filter((box) => box.group).map((box) => box.id)].flatMap((container) => {
    const connected = new Set(
      valid.flatMap(({ from, to }) => {
        const [a, b] = [childOf(container, from), childOf(container, to)];
        return a === b ? [] : [a, b].flatMap((id) => (id ? [id] : []));
      }),
    );
    const loose = inside(container)
      .filter((box) => !connected.has(box.id))
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    looseIn.set(container, new Set(loose.map((box) => box.id)));
    return loose.slice(1).map((box, index) => ({ from: loose[index].id, to: box.id }));
  });

  const graph = await new ELK().layout({
    id: "root",
    layoutOptions: boxes.some((box) => box.group && inside(box.id).length > 0)
      ? { ...spaced, "elk.hierarchyHandling": "INCLUDE_CHILDREN" }
      : { ...spaced, ...keepDrawnOrder },
    children: inside(undefined).map(toElk),
    edges: [...valid, ...ordering].map(({ from, to }, index) => ({
      id: `link${index}`,
      sources: [hasContents(from) ? from : `${from}${OUT}`],
      targets: [hasContents(to) ? to : `${to}${IN}`],
    })),
  });

  const tidy = (node: ElkNode, container: string | undefined) => {
    const children = node.children ?? [];
    for (const child of children) tidy(child, child.id);
    const loose = children.filter((child) => looseIn.get(container)?.has(child.id));
    const rowTop = Math.min(...loose.map((child) => child.y ?? 0));
    for (const child of loose) child.y = rowTop;
    if (container && children.length > 0) {
      node.height = Math.max(...children.map((child) => (child.y ?? 0) + (child.height ?? 0))) + BOUNDARY_MARGIN;
    }
  };
  tidy(graph, undefined);

  const top = graph.children ?? [];
  const left = Math.min(...top.map((node) => node.x ?? 0));
  const upper = Math.min(...top.map((node) => node.y ?? 0));

  const positions = new Map<string, Position>();
  const sizes = new Map<string, Size>();
  const read = (node: ElkNode, offset: Position) => {
    const at = { x: offset.x + (node.x ?? 0), y: offset.y + (node.y ?? 0) };
    positions.set(node.id, at);
    if (node.children?.length) {
      sizes.set(node.id, { width: node.width ?? 0, height: node.height ?? 0 });
      for (const child of node.children) read(child, at);
    }
  };
  for (const node of top) read(node, { x: origin.x - left, y: origin.y - upper });
  return { positions, sizes };
}
