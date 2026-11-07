import { type Node, useReactFlow } from "@xyflow/react";
import { useRef } from "react";
import type { Diagram } from "../../../diagram/schema";
import { formatLayout, getAppState } from "../../state";
import { type Layout, layout } from "../layout/format";
import { BOUNDARY_HEADER, estimatedSize } from "../nodes/sizes";
import { useFitDiagram } from "./useFitDiagram";

const headerOf = (id: string) =>
  BOUNDARY_HEADER +
  (document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"] [data-description]`)
    ?.offsetHeight ?? 0);

export async function arrange(
  diagram: Diagram,
  getNode: (id: string) => Node | undefined,
): Promise<Layout | undefined> {
  // Free text is the user's own annotation and stays where it was put.
  const objects = diagram.objects.filter((object) => object.type !== "text");
  if (objects.length === 0) return undefined;
  const boxes = objects.map((object) => ({
    id: object.id,
    ...estimatedSize[object.type],
    ...getNode(object.id)?.measured,
    ...(object.type === "boundary" && { ...object.size, group: true, header: headerOf(object.id) }),
    ...(object.parent && { parent: object.parent }),
    x: object.position.x,
  }));
  const origin = {
    x: Math.min(...objects.map((object) => object.position.x)),
    y: Math.min(...objects.map((object) => object.position.y)),
  };
  return layout(boxes, diagram.connections, origin);
}

export function useFormat() {
  const { getNode } = useReactFlow();
  const fitDiagram = useFitDiagram();
  const running = useRef(false);

  return async ({ animate = true } = {}) => {
    if (running.current) return;
    running.current = true;
    try {
      const { diagram } = getAppState();
      const arranged = await arrange(diagram, getNode);
      if (!arranged || getAppState().diagram !== diagram) return;
      formatLayout(arranged.positions, arranged.sizes);
    } catch (error) {
      console.error("Could not format the layout", error);
      return;
    } finally {
      running.current = false;
    }
    // Once the canvas has drawn the new positions.
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    await fitDiagram({ duration: animate ? 300 : 0 });
  };
}
