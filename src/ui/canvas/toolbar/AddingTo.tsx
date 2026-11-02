import { X } from "lucide-react";
import { insertionTarget, select, useAppState } from "../../state";
import { boundaryIcon, boundaryName } from "./boundaryCatalog";

export function AddingTo() {
  const target = useAppState(insertionTarget);
  if (!target) return null;
  const Icon = boundaryIcon(target.kind);
  return (
    <div className="mb-1 flex items-center gap-2 rounded-lg bg-accent/10 px-2 py-1.5 text-[12px] text-fg">
      <Icon size={14} strokeWidth={1.75} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted">Adding to </span>
        <span className="font-medium">{boundaryName(target)}</span>
      </span>
      <button
        type="button"
        aria-label="Add to the canvas instead"
        title="Add to the canvas instead"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => select([])}
        className="shrink-0 rounded p-0.5 text-muted hover:bg-accent/15 hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  );
}
