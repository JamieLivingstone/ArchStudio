import type { Diagram, DiagramObject } from "./schema";

export function descendantsOf(diagram: Diagram, id: string): DiagramObject[] {
  const found: DiagramObject[] = [];
  // A diagram read from a file may have a parent loop, which must not hang the app.
  const seen = new Set([id]);
  const queue = [id];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const object of diagram.objects) {
      if (object.parent === next && !seen.has(object.id)) {
        seen.add(object.id);
        found.push(object);
        queue.push(object.id);
      }
    }
  }
  return found;
}

export function ancestorsOf(diagram: Diagram, object: DiagramObject): DiagramObject[] {
  const found: DiagramObject[] = [];
  const seen = new Set([object.id]);
  for (let id = object.parent; id && !seen.has(id); ) {
    const parent = diagram.objects.find((candidate) => candidate.id === id);
    if (!parent) break;
    found.push(parent);
    seen.add(id);
    id = parent.parent;
  }
  return found;
}

export function parentsFirst(diagram: Diagram): DiagramObject[] {
  const depth = (object: DiagramObject) => ancestorsOf(diagram, object).length;
  return diagram.objects
    .map((object, index) => ({ object, index, depth: depth(object) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map(({ object }) => object);
}

export function boundaryAt(
  diagram: Diagram,
  point: { x: number; y: number },
  excluding: ReadonlySet<string> = new Set(),
): DiagramObject | undefined {
  let found: DiagramObject | undefined;
  for (const object of diagram.objects) {
    if (object.type !== "boundary" || excluding.has(object.id)) continue;
    const { x, y } = object.position;
    const { width, height } = object.size;
    const inside = point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    if (inside && (!found || ancestorsOf(diagram, object).length > ancestorsOf(diagram, found).length)) {
      found = object;
    }
  }
  return found;
}
