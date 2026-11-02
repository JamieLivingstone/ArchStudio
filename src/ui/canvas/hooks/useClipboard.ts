import { useRef } from "react";
import { descendantsOf, parentsFirst } from "../../../diagram/hierarchy";
import type { DiagramOperation } from "../../../diagram/operations";
import type { Connection, DiagramObject } from "../../../diagram/schema";
import { type AppState, change, getAppState, remove, select, selectedObjects } from "../../state";

interface Clip {
  objects: DiagramObject[];
  connections: Connection[];
}

const PASTE_OFFSET = 24;

export function copySelection(state: AppState): Clip {
  const included = new Set(
    selectedObjects(state).flatMap((object) => [
      object.id,
      ...descendantsOf(state.diagram, object.id).map(({ id }) => id),
    ]),
  );
  const objects = parentsFirst(state.diagram).filter((object) => included.has(object.id));
  const ids = new Set(objects.map((object) => object.id));
  return {
    objects,
    connections: state.diagram.connections.filter(({ from, to }) => ids.has(from) && ids.has(to)),
  };
}

export function pasteClip(clip: Clip, offset: number): Clip {
  const newIds = new Map(clip.objects.map((object) => [object.id, crypto.randomUUID()]));
  return {
    objects: clip.objects.map((object) => ({
      ...object,
      id: newIds.get(object.id) ?? object.id,
      position: { x: object.position.x + offset, y: object.position.y + offset },
      ...(object.parent && { parent: newIds.get(object.parent) ?? object.parent }),
    })),
    connections: clip.connections.map((connection) => ({
      ...connection,
      id: crypto.randomUUID(),
      from: newIds.get(connection.from) ?? connection.from,
      to: newIds.get(connection.to) ?? connection.to,
    })),
  };
}

export function useClipboard() {
  const clip = useRef<Clip | null>(null);
  const pastes = useRef(0);

  function copy() {
    const copied = copySelection(getAppState());
    if (copied.objects.length === 0) return false;
    clip.current = copied;
    pastes.current = 0;
    return true;
  }

  function cut() {
    if (!copy()) return false;
    remove(clip.current?.objects.map((object) => object.id) ?? [], "Cut");
    pastes.current = -1;
    return true;
  }

  function paste() {
    if (!clip.current) return false;
    pastes.current += 1;
    const pasted = pasteClip(clip.current, pastes.current * PASTE_OFFSET);
    const exists = new Set([...getAppState().diagram.objects, ...pasted.objects].map((object) => object.id));
    const objects = pasted.objects.map(({ parent, ...object }) =>
      parent && exists.has(parent) ? { ...object, parent } : object,
    ) as DiagramObject[];
    const operations: DiagramOperation[] = [
      ...objects.map((object): DiagramOperation => ({ type: "object.add", object })),
      ...pasted.connections.map((connection): DiagramOperation => ({ type: "connection.add", connection })),
    ];
    if (!change("Paste", operations)) return false;
    select(objects.map((object) => object.id));
    return true;
  }

  return { copy, cut, paste };
}
