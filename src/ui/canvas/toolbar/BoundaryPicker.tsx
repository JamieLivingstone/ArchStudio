import type { PointerEvent } from "react";
import { type BoundaryKind, boundaryKindNames, boundaryKinds } from "../../../diagram/boundaryKinds";
import type { NewDiagramObject } from "../../../diagram/schema";
import { type DragItem, isAddClick } from "../hooks/useDragToAdd";
import { BOUNDARY_SIZE } from "../nodes/sizes";
import { AddingTo } from "./AddingTo";
import { boundaryIcon } from "./boundaryCatalog";

const newBoundary = (kind?: BoundaryKind): NewDiagramObject => ({
  type: "boundary",
  name: "",
  size: BOUNDARY_SIZE,
  ...(kind ? { kind } : {}),
});

const entries = [
  { kind: undefined, label: "Boundary", description: "A plain frame around anything." },
  ...boundaryKindNames.map((kind) => ({ kind, ...boundaryKinds[kind] })),
];

interface BoundaryPickerProps {
  onAdd: (node: NewDiagramObject) => void;
  onDragStart: (event: PointerEvent, item: DragItem) => void;
}

export function BoundaryPicker({ onAdd, onDragStart }: BoundaryPickerProps) {
  return (
    <section
      aria-label="Boundaries"
      className="floating nowheel flex max-h-96 w-72 max-w-[calc(100vw-100px)] flex-col overflow-y-auto rounded-xl p-1.5"
    >
      <AddingTo />
      <h3 className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted">Boundaries</h3>
      {entries.map(({ kind, label, description }) => {
        const Icon = boundaryIcon(kind);
        const node = newBoundary(kind);
        return (
          <button
            key={label}
            type="button"
            onClick={(event) => {
              if (isAddClick(event)) onAdd(node);
            }}
            onPointerDown={(event) => onDragStart(event, { node, title: label, icon: Icon })}
            className="flex w-full select-none items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
          >
            <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block text-[13px] text-fg">{label}</span>
              <span className="block text-[11px] leading-snug text-muted">{description}</span>
            </span>
          </button>
        );
      })}
      <p className="border-t border-line px-2 pt-1.5 pb-0.5 text-[11px] text-muted">
        Or select several things and group them from Properties
      </p>
    </section>
  );
}
