import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ancestorsOf, descendantsOf } from "../../../diagram/hierarchy";
import {
  fitBoundariesToContents,
  getAppState,
  makeRoomFor,
  moveObjects,
  pendingProposal,
  resizeObject,
  select,
  selectionInScope,
  useAppState,
} from "../../state";
import type { Guides } from "../layout/alignment";
import { fitBoundaries } from "../layout/fitBoundaries";
import { absolutePosition, boundaryUnder, noGuides, sizeOf, snapToNeighbours } from "../layout/geometry";
import { makeRoom } from "../layout/makeRoom";
import type { CanvasNode } from "../nodes/nodeTypes";
import { estimatedSize } from "../nodes/sizes";
import { toEdges, toNodes } from "../projection";

function updateSelection(changes: (NodeChange | EdgeChange)[]) {
  if (!changes.some((change) => change.type === "select")) return;
  const selection = new Set(getAppState().selection);
  for (const change of changes) {
    if (change.type !== "select") continue;
    if (change.selected) selection.add(change.id);
    else selection.delete(change.id);
  }
  select([...selection]);
}

const withoutRemovals = <T extends { type: string }>(changes: T[]) =>
  changes.filter((change) => change.type !== "remove");

function fitToContents(drawn: CanvasNode[]) {
  const measured = new Map(drawn.map((node) => [node.id, node.measured]));
  const fits = fitBoundaries(getAppState().diagram, (object) => {
    if (object.type === "boundary") return object.size;
    const size = measured.get(object.id);
    return size?.width && size.height ? { width: size.width, height: size.height } : estimatedSize[object.type];
  });
  if (fits.size > 0) fitBoundariesToContents(fits);
}

function pushBelow(next: CanvasNode[], id: string, before: number, height: number) {
  const { diagram } = getAppState();
  const object = diagram.objects.find((candidate) => candidate.id === id);
  if (!object || object.type === "boundary" || height <= before) return;
  const related = new Set([...ancestorsOf(diagram, object), ...descendantsOf(diagram, id)].map((other) => other.id));
  const placed = next.flatMap((node) => {
    const position = diagram.objects.find((other) => other.id === node.id)?.position;
    const { width, height: tall } = sizeOf(node);
    return !related.has(node.id) && position && width && tall
      ? [{ id: node.id, ...position, width, height: tall }]
      : [];
  });
  const grown = next.find((node) => node.id === id);
  if (grown) makeRoomFor(makeRoom({ id, ...object.position, width: sizeOf(grown).width, height }, before, placed));
}

export function useCanvasNodes() {
  const diagram = useAppState((state) => state.diagram);
  const selection = useAppState((state) => state.selection);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [guides, setGuides] = useState<Guides>(noGuides);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const proposal = useAppState(pendingProposal);
  const focus = useAppState((state) => state.focus);
  const shown = proposal?.preview ?? diagram;

  useEffect(() => {
    setNodes((previous) => toNodes(shown, selection, previous));
    setEdges(toEdges(shown, selection));
  }, [shown, selection]);

  const latestNodes = useRef(nodes);
  latestNodes.current = nodes;
  useEffect(() => {
    if (shown === diagram && diagram.objects.some((object) => object.type === "boundary")) {
      fitToContents(latestNodes.current);
    }
  }, [shown, diagram]);

  const inScope = useAppState(useShallow(selectionInScope));
  const included = new Set(inScope.map((object) => object.id).filter((id) => !selection.includes(id)));
  const proposed = new Map(
    proposal?.changes.flatMap(({ id, change }) => (change === "moved" ? [] : [[id, `proposed-${change}`]])),
  );
  const proposedClass = (id: string) =>
    proposed.has(id) ? `${proposed.get(id)}${id === focus ? " proposed-focus" : ""}` : undefined;
  const decorated = nodes.map((node) => {
    const className =
      proposedClass(node.id) ??
      (node.id === dropTarget ? "drop-target" : included.has(node.id) ? "in-selected-group" : undefined);
    return className ? { ...node, className } : node;
  });
  const decoratedEdges = proposal
    ? edges.map((edge) => {
        const className = proposedClass(edge.id);
        return { ...edge, className, ...(className?.includes("removed") && { label: "" }) };
      })
    : edges;

  function onNodesChange(changes: NodeChange<CanvasNode>[]) {
    if (proposal) {
      latestNodes.current = applyNodeChanges(withoutRemovals(changes), latestNodes.current);
      setNodes(latestNodes.current);
      return;
    }
    const { diagram } = getAppState();
    const [first] = changes;
    if (changes.length === 1 && first.type === "position" && first.dragging && first.position) {
      const snapped = snapToNeighbours(diagram, nodes, first.id, first.position);
      setGuides(snapped.guides);
      changes = [{ ...first, position: snapped.position }];
      const moving = nodes.find((node) => node.id === first.id);
      if (moving) {
        const position = absolutePosition(diagram, moving, snapped.position);
        setDropTarget(boundaryUnder(diagram, { id: first.id, position, ...sizeOf(moving) }));
      }
    }
    // React Flow ends a drag at the unsnapped pointer position; keep where the node was last drawn instead.
    changes = changes.map((change) =>
      change.type === "position" && change.dragging === false ? { ...change, position: undefined } : change,
    );

    // React Flow can report sizes in several batches before the next render;
    // building on the latest nodes keeps one batch from undoing the one before it.
    const current = latestNodes.current;
    const next = applyNodeChanges(withoutRemovals(changes), current);
    latestNodes.current = next;
    setNodes(next);
    updateSelection(changes);
    const drawn = (id: string) => next.find((node) => node.id === id);

    const dropped = changes.flatMap((change) => {
      const node = change.type === "position" && change.dragging === false ? drawn(change.id) : undefined;
      return node ? [{ id: node.id, position: absolutePosition(diagram, node), ...sizeOf(node) }] : [];
    });
    if (dropped.length > 0) {
      setGuides(noGuides);
      setDropTarget(null);
      moveObjects(dropped.map((move) => ({ ...move, parent: boundaryUnder(diagram, move, dropped) })));
    }

    for (const change of changes) {
      if (change.type !== "dimensions" || !change.dimensions) continue;
      const node = drawn(change.id);
      if (!node) continue;
      if (change.resizing === false) resizeObject(change.id, change.dimensions, absolutePosition(diagram, node));
      const before = current.find((candidate) => candidate.id === change.id)?.measured?.height;
      if (change.resizing === undefined && !node.resizing && before !== undefined) {
        pushBelow(next, change.id, before, change.dimensions.height);
      }
    }

    if (changes.some((change) => change.type === "dimensions" && change.resizing !== true)) fitToContents(next);
  }

  function onEdgesChange(changes: EdgeChange<Edge>[]) {
    setEdges((current) => applyEdgeChanges(withoutRemovals(changes), current));
    if (!proposal) updateSelection(changes);
  }

  return { nodes: decorated, edges: decoratedEdges, guides, onNodesChange, onEdgesChange };
}
