import { MiniMap, useReactFlow, useStore } from "@xyflow/react";
import { Map as MapIcon, Maximize, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../../components/IconButton";
import { useFitDiagram } from "../hooks/useFitDiagram";

export function ViewControls() {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const fitDiagram = useFitDiagram();
  const zoom = useStore((state) => state.transform[2]);
  const [mapShown, setMapShown] = useState(false);

  return (
    <>
      <div className="floating flex items-center gap-0.5 rounded-xl p-1.5">
        <div className="contents max-sm:hidden">
          <IconButton label="Zoom out" icon={Minus} tooltip="top" onClick={() => zoomOut({ duration: 150 })} />
        </div>
        <button
          type="button"
          aria-label="Zoom to 100%"
          onClick={() => zoomTo(1, { duration: 150 })}
          className="h-9 w-12 rounded-lg text-xs text-muted tabular-nums transition-colors hover:bg-hover hover:text-fg"
        >
          {Math.round(zoom * 100)}%
        </button>
        <div className="contents max-sm:hidden">
          <IconButton label="Zoom in" icon={Plus} tooltip="top" onClick={() => zoomIn({ duration: 150 })} />
        </div>
        <span aria-hidden="true" className="mx-0.5 w-px self-stretch bg-line" />
        <IconButton label="Fit to window" icon={Maximize} tooltip="top" onClick={() => void fitDiagram()} />
        <div className="contents max-sm:hidden">
          <IconButton
            label={mapShown ? "Hide map" : "Show map"}
            icon={MapIcon}
            tooltip="top"
            active={mapShown}
            aria-pressed={mapShown}
            onClick={() => setMapShown(!mapShown)}
          />
        </div>
      </div>
      {mapShown && (
        <MiniMap
          position="bottom-left"
          pannable
          zoomable
          ariaLabel="Map"
          bgColor="var(--surface)"
          maskColor="color-mix(in srgb, var(--canvas) 70%, transparent)"
          nodeColor="color-mix(in srgb, var(--muted) 35%, transparent)"
          nodeBorderRadius={8}
          className="floating overflow-hidden rounded-xl"
          style={{ marginBottom: 76 }}
        />
      )}
    </>
  );
}
