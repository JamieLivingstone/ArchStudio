import type { Edge } from "@xyflow/react";
import { parentsFirst } from "../../diagram/hierarchy";
import type { Connection, Diagram, DiagramObject } from "../../diagram/schema";
import { ARROW } from "./edges/ConnectionEdge";
import type { CanvasNode } from "./nodes/nodeTypes";
import { RECTANGLE_SIZE } from "./nodes/sizes";

function toNode(object: DiagramObject): CanvasNode {
  const { id, position } = object;
  if (object.type === "component") {
    const { name, kind, options, tags = [], icon, description, structure } = object;
    return {
      id,
      position,
      type: "component",
      data: { label: name, kind, options, tags, icon, description, structure },
    };
  }
  if (object.type === "sphere") {
    return {
      id,
      position,
      type: "sphere",
      data: { label: object.text, icon: object.icon, description: object.description, diameter: object.size?.width },
    };
  }
  if (object.type === "text") return { id, position, type: "text", data: { label: object.text } };
  if (object.type === "boundary") {
    const { name, kind, icon, description, tags } = object;
    return { id, position, type: "boundary", data: { label: name, kind, icon, description, tags, empty: true } };
  }
  const { text, icon, description, tags } = object;
  return { id, position, type: "rectangle", data: { label: text, icon, description, tags } };
}

function toEdge({ id, from, to, fromSide = "right", toSide = "left", label, direction, line }: Connection): Edge {
  return {
    id,
    type: "connection",
    source: from,
    target: to,
    sourceHandle: fromSide,
    targetHandle: toSide,
    label,
    markerStart: direction === "backward" || direction === "both" ? ARROW : undefined,
    markerEnd: direction === "forward" || direction === "both" ? ARROW : undefined,
    animated: line === "flow",
    style: line === "dashed" ? { strokeDasharray: "6 4" } : undefined,
  };
}

function nodeSize(object: DiagramObject): { width?: number; height?: number } {
  if (object.type === "rectangle") {
    const card = object.icon || object.description || object.tags?.length;
    return object.size ?? (card ? {} : RECTANGLE_SIZE);
  }
  if (object.type === "boundary") return object.size;
  return {};
}

export function toNodes(diagram: Diagram, selection: readonly string[], previous: CanvasNode[]): CanvasNode[] {
  const measured = new Map(previous.map((node) => [node.id, node.measured]));
  const positions = new Map(diagram.objects.map((object) => [object.id, object.position]));
  const containers = new Set(diagram.objects.flatMap((object) => (object.parent ? [object.parent] : [])));
  return parentsFirst(diagram).map((object) => {
    const parent = object.parent ? positions.get(object.parent) : undefined;
    const node = toNode(object);
    if (node.type === "boundary") node.data.empty = !containers.has(object.id);
    return {
      ...node,
      ...nodeSize(object),
      ...(parent && {
        parentId: object.parent,
        position: { x: node.position.x - parent.x, y: node.position.y - parent.y },
      }),
      selected: selection.includes(object.id),
      ...(node.type === "boundary" && !selection.includes(object.id) && { draggable: false }),
      measured: measured.get(object.id),
    } as CanvasNode;
  });
}

export function toEdges(diagram: Diagram, selection: readonly string[]): Edge[] {
  return diagram.connections.map((connection) => ({
    ...toEdge(connection),
    selected: selection.includes(connection.id),
  }));
}
