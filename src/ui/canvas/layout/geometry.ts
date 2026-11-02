import { boundaryAt, descendantsOf } from "../../../diagram/hierarchy";
import type { Diagram, Position, Size } from "../../../diagram/schema";
import type { CanvasNode } from "../nodes/nodeTypes";
import { align, type Guides } from "./alignment";

export const noGuides: Guides = { x: [], y: [] };

export const sizeOf = (node: CanvasNode): Size => ({
  width: node.measured?.width ?? 0,
  height: node.measured?.height ?? 0,
});

const objectWithId = (diagram: Diagram, id: string) => diagram.objects.find((object) => object.id === id);

export function absolutePosition(diagram: Diagram, node: CanvasNode, position = node.position): Position {
  const parent = node.parentId ? objectWithId(diagram, node.parentId) : undefined;
  return parent ? { x: position.x + parent.position.x, y: position.y + parent.position.y } : position;
}

export function boundaryUnder(
  diagram: Diagram,
  { id, position, width, height }: { id: string; position: Position } & Size,
  dropped: { id: string; position: Position }[] = [],
): string | null {
  const landed = new Map(dropped.map((move) => [move.id, move.position]));
  const now = {
    ...diagram,
    objects: diagram.objects.map((object) => ({ ...object, position: landed.get(object.id) ?? object.position })),
  };
  const excluded = new Set([id, ...descendantsOf(diagram, id).map((object) => object.id)]);
  return boundaryAt(now, { x: position.x + width / 2, y: position.y + height / 2 }, excluded)?.id ?? null;
}

export function snapToNeighbours(
  diagram: Diagram,
  nodes: CanvasNode[],
  id: string,
  position: Position,
): { position: Position; guides: Guides } {
  const moving = nodes.find((node) => node.id === id);
  if (!moving) return { position, guides: noGuides };
  const centred = ({ x, y }: Position, { width, height }: Size) => ({
    x: x + width / 2,
    y: y + height / 2,
    width,
    height,
  });
  const inside = new Set(descendantsOf(diagram, id).map((object) => object.id));
  const others = nodes.flatMap((node) => {
    const at = objectWithId(diagram, node.id)?.position;
    return node.id !== id && !inside.has(node.id) && node.measured && at ? [centred(at, sizeOf(node))] : [];
  });
  const { width, height } = sizeOf(moving);
  const absolute = absolutePosition(diagram, moving, position);
  const snapped = align(centred(absolute, sizeOf(moving)), others);
  return {
    position: {
      x: snapped.position.x - width / 2 - (absolute.x - position.x),
      y: snapped.position.y - height / 2 - (absolute.y - position.y),
    },
    guides: snapped.guides,
  };
}
