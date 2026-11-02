import { Search } from "lucide-react";
import { type PointerEvent, useState } from "react";
import type { ComponentKind } from "../../../diagram/componentKinds";
import type { NewDiagramObject } from "../../../diagram/schema";
import { type DragItem, isAddClick } from "../hooks/useDragToAdd";
import { AddingTo } from "./AddingTo";
import { componentCatalog } from "./componentCatalog";

function focusOnMount(element: HTMLInputElement | null) {
  element?.focus();
}

const newComponent = (kind: ComponentKind, name: string): NewDiagramObject => ({
  type: "component",
  kind,
  name,
  options: {},
});

interface ComponentPickerProps {
  onAdd: (node: NewDiagramObject) => void;
  onDragStart: (event: PointerEvent, item: DragItem) => void;
}

export function ComponentPicker({ onAdd, onDragStart }: ComponentPickerProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const groups = componentCatalog
    .map((category) => ({
      title: category.title,
      items: category.items.filter(
        (item) => item.label.toLowerCase().includes(needle) || category.title.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);

  function addFirstMatch() {
    const first = groups[0]?.items[0];
    if (first) onAdd(newComponent(first.kind, first.label));
  }

  return (
    <section aria-label="Components" className="floating flex max-h-96 w-64 flex-col rounded-xl">
      <div className="px-1.5 pt-1.5 empty:hidden">
        <AddingTo />
      </div>
      <label className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Search size={15} strokeWidth={1.75} className="shrink-0 text-muted" />
        <input
          ref={focusOnMount}
          type="search"
          value={query}
          placeholder="Search components"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addFirstMatch();
          }}
          className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-muted"
        />
      </label>

      <div className="nowheel min-h-0 flex-1 overflow-y-auto p-1.5">
        {groups.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-muted">No components match.</p>}
        {groups.map((group) => (
          <div key={group.title} className="pb-1.5 last:pb-0">
            <h3 className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted">{group.title}</h3>
            {group.items.map(({ kind, label, icon: Icon, tone }) => {
              const node = newComponent(kind, label);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={(event) => {
                    if (isAddClick(event)) onAdd(node);
                  }}
                  onPointerDown={(event) => onDragStart(event, { node, title: label, icon: Icon })}
                  className="flex w-full select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg hover:bg-hover"
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${tone}`}>
                    <Icon size={14} strokeWidth={1.75} />
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
