import { useLayoutEffect, useSyncExternalStore } from "react";
import type { Position } from "../../../diagram/schema";
import { placeLabels } from "../layout/labels";
import { type Box, type RouteRequest, routeAll } from "../layout/route";

interface Routed {
  points?: Position[];
  label?: Position;
}

// Lines are routed together so they keep off each other's tracks. Changes are announced once per redraw.
const requests = new Map<string, RouteRequest & { text: string }>();
let nodes: Box[] = [];
let routed = new Map<string, Routed>();
let stale = false;
let announcing = false;
const listeners = new Set<() => void>();
const unrouted: Routed = {};

function routedFor(id: string): Routed {
  if (stale) {
    const all = [...requests.values()];
    const routes = routeAll(all, nodes);
    const labels = placeLabels(
      all.flatMap(({ id, text }) => {
        const points = routes.get(id);
        return points ? [{ id, points, text }] : [];
      }),
      nodes,
    );
    routed = new Map(all.map(({ id }) => [id, { points: routes.get(id), label: labels.get(id) }]));
    stale = false;
  }
  return routed.get(id) ?? unrouted;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  stale = true;
  if (announcing) return;
  announcing = true;
  queueMicrotask(() => {
    announcing = false;
    for (const listener of listeners) listener();
  });
}

export function useRoute(request: RouteRequest & { text: string }, obstacles: Box[]): Routed {
  const { id, from, to, source, target, fromSide, toSide, text } = request;
  const { x: sourceX, y: sourceY } = source;
  const { x: targetX, y: targetY } = target;
  useLayoutEffect(() => {
    requests.set(id, {
      id,
      from,
      to,
      fromSide,
      toSide,
      text,
      source: { x: sourceX, y: sourceY },
      target: { x: targetX, y: targetY },
    });
    nodes = obstacles;
    changed();
    return () => {
      requests.delete(id);
      changed();
    };
  }, [id, from, to, fromSide, toSide, text, sourceX, sourceY, targetX, targetY, obstacles]);
  return useSyncExternalStore(subscribe, () => routedFor(id));
}
