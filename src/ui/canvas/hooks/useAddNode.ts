import { useReactFlow } from "@xyflow/react";
import { getKindDefinition } from "../../../diagram/componentKinds";
import { ancestorsOf, boundaryAt } from "../../../diagram/hierarchy";
import type { DiagramObject, NewDiagramObject } from "../../../diagram/schema";
import { addObject, getAppState, insertionTarget } from "../../state";
import { type Box, findFreePosition, type Point } from "../layout/placement";
import { BOUNDARY_HEADER, BOUNDARY_MARGIN, estimatedSize } from "../nodes/sizes";

const ROW_GAP = 40;

export function useAddNode() {
  const { screenToFlowPosition, flowToScreenPosition, getNode, fitView, getZoom } = useReactFlow();

  return (object: NewDiagramObject, at?: Point) => {
    const state = getAppState();
    const { diagram } = state;
    const target = at ? undefined : insertionTarget(state);
    const around = new Set(target ? [target.id, ...ancestorsOf(diagram, target).map(({ id }) => id)] : []);
    const sizeOf = (placed: DiagramObject) => ({
      ...estimatedSize[placed.type],
      ...("size" in placed && placed.size),
      ...getNode(placed.id)?.measured,
    });
    // From the diagram, not React Flow's nodes, which lag behind an add made a moment ago.
    const taken: Box[] = diagram.objects
      .filter(({ id }) => !around.has(id))
      .map((placed) => {
        const { width, height } = sizeOf(placed);
        return { x: placed.position.x + width / 2, y: placed.position.y + height / 2, width, height };
      });
    const size = { ...estimatedSize[object.type], ...("size" in object && object.size) };
    let centre: Point;
    if (at) {
      centre = screenToFlowPosition(at);
    } else if (target) {
      const contents = diagram.objects.filter((placed) => placed.parent === target.id);
      const corner = contents.length
        ? {
            x: Math.max(...contents.map((placed) => placed.position.x + sizeOf(placed).width)) + ROW_GAP,
            y: Math.min(...contents.map((placed) => placed.position.y)),
          }
        : { x: target.position.x + BOUNDARY_MARGIN, y: target.position.y + BOUNDARY_HEADER };
      centre = { x: corner.x + size.width / 2, y: corner.y + size.height / 2 };
    } else {
      centre = findFreePosition(
        screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
        size,
        taken,
      );
    }
    const position = { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
    const parent = at ? boundaryAt(diagram, centre)?.id : target?.id;
    const what =
      object.type === "component"
        ? getKindDefinition(object.kind).label
        : object.type === "boundary"
          ? "boundary"
          : object.type;
    const id = crypto.randomUUID();
    addObject(
      { ...object, id, position, ...(parent ? { parent } : {}) } as DiagramObject,
      `Add ${what.toLowerCase()}`,
      { keepSelection: object.type === "boundary" && target !== undefined },
    );

    const topLeft = flowToScreenPosition(position);
    const bottomRight = flowToScreenPosition({ x: position.x + size.width, y: position.y + size.height });
    const visible =
      topLeft.x >= 0 && topLeft.y >= 0 && bottomRight.x <= window.innerWidth && bottomRight.y <= window.innerHeight;
    if (!visible) {
      window.setTimeout(
        () => fitView({ nodes: [{ id: target?.id ?? id }], duration: 300, padding: 0.2, maxZoom: getZoom() }),
        50,
      );
    }
  };
}
