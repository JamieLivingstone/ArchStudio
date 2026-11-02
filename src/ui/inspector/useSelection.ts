import { useShallow } from "zustand/react/shallow";
import { nameOf } from "../../diagram/describe";
import type { Connection, DiagramObject } from "../../diagram/schema";
import { boundaryName } from "../canvas/toolbar/boundaryCatalog";
import { selectedConnections, selectedObjects, selectionInScope, useAppState } from "../state";

export function useSelectedObjects(): DiagramObject[] {
  return useAppState(useShallow(selectedObjects));
}

export function useSelectedConnections(): Connection[] {
  return useAppState(useShallow(selectedConnections));
}

const shownName = (object: DiagramObject) =>
  object.type === "boundary" ? boundaryName(object) : nameOf(object) || "Untitled";

export function useSelectionScope(): string {
  return useAppState((state) => {
    const names = selectedObjects(state).map(shownName);
    const shown = names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
    const inside = selectionInScope(state).length - names.length;
    return inside > 0 ? `${shown} (+${inside} inside)` : shown;
  });
}
