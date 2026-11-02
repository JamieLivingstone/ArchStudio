import { useStore } from "@xyflow/react";
import type { Guides } from "./layout/alignment";

export function AlignmentGuides({ guides }: { guides: Guides }) {
  const [panX, panY, zoom] = useStore((state) => state.transform);
  if (guides.x.length === 0 && guides.y.length === 0) return null;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-4 size-full">
      {guides.x.map((x) => (
        <line key={`x${x}`} x1={x * zoom + panX} x2={x * zoom + panX} y1="0" y2="100%" stroke="var(--accent)" />
      ))}
      {guides.y.map((y) => (
        <line key={`y${y}`} x1="0" x2="100%" y1={y * zoom + panY} y2={y * zoom + panY} stroke="var(--accent)" />
      ))}
    </svg>
  );
}
