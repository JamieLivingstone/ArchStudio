import type { LucideIcon } from "lucide-react";
import { type MouseEvent, type PointerEvent as ReactPointerEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { NewDiagramObject } from "../../../diagram/schema";
import type { Point } from "../layout/placement";

export interface DragItem {
  node: NewDiagramObject;
  title: string;
  icon: LucideIcon;
}

const DRAG_THRESHOLD = 6;

// A double-click, or the keyboard, which reports a click count of 0.
export function isAddClick(event: MouseEvent): boolean {
  return event.detail === 0 || event.detail === 2;
}

function isOverCanvas({ x, y }: Point): boolean {
  const target = document.elementFromPoint(x, y);
  return Boolean(target?.closest(".react-flow")) && !target?.closest(".react-flow__panel");
}

// Pointer events rather than HTML drag and drop, which the Tauri webview intercepts for files.
export function useDragToAdd(onDrop: (node: NewDiagramObject, at: Point) => void) {
  const [drag, setDrag] = useState<(DragItem & Point) | null>(null);

  function beginDrag(event: ReactPointerEvent, item: DragItem) {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;

    function handleMove(move: PointerEvent) {
      const distance = Math.hypot(move.clientX - start.x, move.clientY - start.y);
      if (!dragging && distance < DRAG_THRESHOLD) return;
      dragging = true;
      setDrag({ ...item, x: move.clientX, y: move.clientY });
    }

    function handleEnd(end: PointerEvent) {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleEnd);
      document.removeEventListener("pointercancel", handleEnd);
      setDrag(null);
      const at = { x: end.clientX, y: end.clientY };
      if (dragging && end.type === "pointerup" && isOverCanvas(at)) onDrop(item.node, at);
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleEnd);
    document.addEventListener("pointercancel", handleEnd);
  }

  const ghost =
    drag &&
    createPortal(
      <div
        data-testid="drag-ghost"
        style={{ left: drag.x + 12, top: drag.y + 12 }}
        className="floating pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg"
      >
        <drag.icon size={14} strokeWidth={1.75} className="text-muted" />
        {drag.title}
      </div>,
      document.body,
    );

  return { beginDrag, ghost };
}
