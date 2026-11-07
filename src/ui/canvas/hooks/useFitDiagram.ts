import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useCallback } from "react";
import { fitViewport } from "../layout/fit";

export function fitOptions() {
  const inspector = document.querySelector<HTMLElement>("[data-inspector]:not([inert])");
  if (window.innerWidth < 640) {
    const bottom = inspector ? inspector.offsetHeight + 16 : 72;
    return { padding: { top: 16, right: 16, bottom, left: 72 }, minZoom: 0.5 };
  }
  const right = inspector ? inspector.offsetWidth + 30 : 80;
  return { padding: { top: 24, right, bottom: 80, left: 80 }, minZoom: 0.3 };
}

export function useFitDiagram() {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const store = useStoreApi();

  return useCallback(
    async ({ ids, maxZoom = 1, duration = 300 }: { ids?: string[]; maxZoom?: number; duration?: number } = {}) => {
      const nodes = ids ?? getNodes();
      const { width, height } = store.getState();
      if (nodes.length === 0 || width === 0) return;
      const { padding, minZoom } = fitOptions();
      const viewport = fitViewport(getNodesBounds(nodes), { width, height }, padding, { minZoom, maxZoom });
      await setViewport(viewport, { duration });
    },
    [getNodes, getNodesBounds, setViewport, store],
  );
}
