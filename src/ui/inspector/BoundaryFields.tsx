import { ChevronRight, X } from "lucide-react";
import { Fragment } from "react";
import { useShallow } from "zustand/react/shallow";
import { type BoundaryKind, boundaryKindNames, boundaryKinds } from "../../diagram/boundaryKinds";
import type { OptionDefinition } from "../../diagram/componentKinds";
import { ancestorsOf } from "../../diagram/hierarchy";
import type { DiagramObject } from "../../diagram/schema";
import { boundaryIcon, boundaryName } from "../canvas/toolbar/boundaryCatalog";
import { groupSelected, moveOutOfBoundary, select, setBoundaryKind, useAppState } from "../state";
import { OptionControl } from "./ComponentDetails";
import { sectionHeading } from "./styles";

const kindOption: OptionDefinition = {
  key: "kind",
  label: "Kind",
  description: "What the boundary is, which tells a reader and the AI what crossing it means.",
  type: "choice",
  choices: boundaryKindNames.map((kind) => ({
    value: boundaryKinds[kind].label,
    description: boundaryKinds[kind].description,
  })),
};

export function BoundaryKindField({ id, kind }: { id: string; kind: BoundaryKind | undefined }) {
  const kindOf = (label: unknown) => boundaryKindNames.find((name) => boundaryKinds[name].label === label);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <OptionControl
          option={kindOption}
          value={kind && boundaryKinds[kind].label}
          onChange={(label) => setBoundaryKind(id, kindOf(label))}
        />
      </div>
      {kind && (
        <button
          type="button"
          aria-label="Clear Kind"
          onClick={() => setBoundaryKind(id, undefined)}
          className="rounded p-0.5 text-muted hover:bg-hover hover:text-fg"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function Containment({ object }: { object: DiagramObject }) {
  const path = useAppState(useShallow((state) => ancestorsOf(state.diagram, object).reverse()));
  if (path.length === 0) return null;
  return (
    <nav aria-label="Inside" className="flex items-center gap-1 border-b border-line px-4 py-2 text-xs text-muted">
      <span className="shrink-0">In</span>
      <span className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
        {path.map((boundary, index) => (
          <Fragment key={boundary.id}>
            {index > 0 && <ChevronRight size={12} className="shrink-0" />}
            <button
              type="button"
              onClick={() => select([boundary.id])}
              className="truncate rounded px-1 py-0.5 font-medium text-fg hover:bg-hover"
            >
              {boundary.type === "boundary" ? boundaryName(boundary) : boundary.id}
            </button>
          </Fragment>
        ))}
      </span>
      <button
        type="button"
        onClick={() => moveOutOfBoundary(object.id)}
        className="shrink-0 rounded px-1.5 py-0.5 hover:bg-hover hover:text-fg"
      >
        Move out
      </button>
    </nav>
  );
}

export function GroupInto() {
  const entries = [undefined, ...boundaryKindNames];
  return (
    <div className="p-4">
      <h4 className={sectionHeading}>Group into boundary</h4>
      <div className="grid grid-cols-2 gap-1">
        {entries.map((kind) => {
          const Icon = boundaryIcon(kind);
          return (
            <button
              key={kind ?? "plain"}
              type="button"
              onClick={() => groupSelected(kind)}
              className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-left text-[13px] text-fg transition-colors hover:border-accent/50 hover:bg-accent/5"
            >
              <Icon size={14} strokeWidth={1.75} className="shrink-0 text-accent" />
              <span className="truncate">{kind ? boundaryKinds[kind].label : "Boundary"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
