import { ancestorsOf, descendantsOf } from "../../../diagram/hierarchy";
import type { Diagram, DiagramObject, Position, Size } from "../../../diagram/schema";
import { BOUNDARY_HEADER, BOUNDARY_MARGIN } from "../nodes/sizes";

type Box = Position & Size;

const sideBySide = (a: Box, b: Box) => a.y < b.y + b.height && b.y < a.y + a.height;
const stacked = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width;

export function fitBoundaries(
  diagram: Diagram,
  sizeOf: (object: DiagramObject) => Size | undefined,
): Map<string, { position: Position; size?: Size }> {
  const changes = new Map<string, { position: Position; size?: Size }>();
  const positions = new Map(diagram.objects.map((object) => [object.id, object.position]));
  const boxes = new Map<string, Box>();
  for (const object of diagram.objects) {
    const size = sizeOf(object);
    if (size) boxes.set(object.id, { ...object.position, ...size });
  }

  function shift(object: DiagramObject, by: Position) {
    for (const moved of [object, ...descendantsOf(diagram, object.id)]) {
      const at = positions.get(moved.id) ?? moved.position;
      const position = { x: at.x + by.x, y: at.y + by.y };
      positions.set(moved.id, position);
      const box = boxes.get(moved.id);
      if (box) boxes.set(moved.id, { ...box, ...position });
      changes.set(moved.id, { ...changes.get(moved.id), position });
    }
  }

  const boundaries = diagram.objects
    .filter((object) => object.type === "boundary")
    .sort((a, b) => ancestorsOf(diagram, b).length - ancestorsOf(diagram, a).length);
  for (const boundary of boundaries) {
    const own = boxes.get(boundary.id);
    const contents = diagram.objects.flatMap((object) => {
      const box = object.parent === boundary.id ? boxes.get(object.id) : undefined;
      return box ? [box] : [];
    });
    if (!own || contents.length === 0) continue;
    const left = Math.min(own.x, ...contents.map((box) => box.x - BOUNDARY_MARGIN));
    const top = Math.min(own.y, ...contents.map((box) => box.y - BOUNDARY_HEADER));
    const right = Math.max(own.x + own.width, ...contents.map((box) => box.x + box.width + BOUNDARY_MARGIN));
    const bottom = Math.max(own.y + own.height, ...contents.map((box) => box.y + box.height + BOUNDARY_MARGIN));
    if (left === own.x && top === own.y && right === own.x + own.width && bottom === own.y + own.height) continue;

    const grown = { x: left, y: top, width: right - left, height: bottom - top };
    boxes.set(boundary.id, grown);
    positions.set(boundary.id, { x: left, y: top });
    changes.set(boundary.id, { position: { x: left, y: top }, size: { width: grown.width, height: grown.height } });

    const wider = right - (own.x + own.width);
    const taller = bottom - (own.y + own.height);
    for (const sibling of diagram.objects) {
      const box = boxes.get(sibling.id);
      if (sibling.id === boundary.id || sibling.parent !== boundary.parent || !box) continue;
      const by = {
        x: wider > 0 && box.x >= own.x + own.width && sideBySide(box, grown) ? wider : 0,
        y: taller > 0 && box.y >= own.y + own.height && stacked(box, grown) ? taller : 0,
      };
      if (by.x || by.y) shift(sibling, by);
    }
  }
  return changes;
}
