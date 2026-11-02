import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeMarker,
  type EdgeProps,
  getSmoothStepPath,
  MarkerType,
  useStore,
} from "@xyflow/react";
import { useMemo, useState } from "react";
import { setConnectionLabel } from "../../state";
import { pointAlong } from "../layout/labels";
import { type Box, toPath } from "../layout/route";
import { BOUNDARY_TITLE } from "../nodes/sizes";
import { useRoute } from "./useRoute";

export const ARROW: EdgeMarker = { type: MarkerType.ArrowClosed, width: 18, height: 18 };
const CLICKABLE_WIDTH = 32;
const CORNER = 12;

function focusAndSelect(element: HTMLInputElement | null) {
  element?.focus();
  element?.select();
}

const cell = "col-start-1 row-start-1 whitespace-pre";

export function ConnectionEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  label,
  markerStart,
  markerEnd,
  style,
}: EdgeProps) {
  const [editing, setEditing] = useState(false);
  const text = typeof label === "string" ? label : "";
  // As flat numbers (x, y, width, height), so the edge only redraws when one changes. Of a boundary, only its
  // title is in the way.
  const boxes = useStore(
    ({ nodeLookup }) =>
      [...nodeLookup.values()].flatMap(({ type, internals, measured }) => [
        internals.positionAbsolute.x,
        internals.positionAbsolute.y,
        measured.width ?? 0,
        type === "boundary" ? BOUNDARY_TITLE : (measured.height ?? 0),
      ]),
    (a, b) => a.length === b.length && a.every((value, index) => value === b[index]),
  );
  const obstacles = useMemo(() => {
    const found: Box[] = [];
    for (let at = 0; at < boxes.length; at += 4) {
      found.push({ x: boxes[at], y: boxes[at + 1], width: boxes[at + 2], height: boxes[at + 3] });
    }
    return found;
  }, [boxes]);
  const { points, label: placed } = useRoute(
    {
      id,
      from: source,
      to: target,
      fromSide: sourcePosition,
      toSide: targetPosition,
      source: { x: sourceX, y: sourceY },
      target: { x: targetX, y: targetY },
      text,
    },
    obstacles,
  );
  const [path, labelX, labelY] = useMemo(() => {
    if (points) {
      const label = placed ?? pointAlong(points, 0.5);
      return [toPath(points, CORNER), label.x, label.y];
    }
    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: CORNER,
    });
  }, [points, placed, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: double-click to edit is a pointer shortcut on a canvas edge
    <g onDoubleClick={() => setEditing(true)}>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={CLICKABLE_WIDTH}
      />

      {(editing || text) && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="nodrag nopan pointer-events-auto absolute rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs text-fg"
          >
            {editing ? (
              <div className="grid min-w-8">
                <span aria-hidden="true" className={`${cell} invisible`}>
                  {text}
                </span>
                <input
                  ref={focusAndSelect}
                  aria-label="Label"
                  size={1}
                  value={text}
                  onChange={(event) => setConnectionLabel(id, event.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") {
                      event.currentTarget.blur();
                    }
                  }}
                  className={`${cell} w-full min-w-0 border-0 bg-transparent p-0 text-center outline-none`}
                />
              </div>
            ) : (
              text
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
