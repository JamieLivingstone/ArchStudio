import { Handle, NodeResizer, type NodeResizerProps, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";

// The canvas connects in loose mode, so each of these is where a line can start or end.
const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left];

interface BaseNodeProps {
  selected: boolean;
  connectable?: boolean;
  resizable?: Pick<NodeResizerProps, "minWidth" | "minHeight" | "keepAspectRatio" | "onResizeStart" | "onResizeEnd">;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function BaseNode({ selected, connectable = true, resizable, className = "", style, children }: BaseNodeProps) {
  return (
    <>
      {resizable && (
        <NodeResizer
          isVisible={selected}
          {...resizable}
          // No `color`: React Flow applies it over lineStyle, which drew a square box around spheres.
          handleStyle={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: "var(--accent)",
            borderColor: "var(--surface)",
          }}
          lineStyle={{ borderColor: "transparent" }}
        />
      )}
      <div style={style} className={`${className} ${selected ? "outline-2 outline-accent" : ""}`}>
        {children}
      </div>

      {connectable && sides.map((side) => <Handle key={side} id={side} type="source" position={side} />)}
    </>
  );
}
