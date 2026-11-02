import { Circle, type LucideIcon, MousePointerClick, MoveRight, Shapes, Square, Trash2, Type } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { boundaryKinds } from "../../diagram/boundaryKinds";
import type { DiagramObject } from "../../diagram/schema";
import { DESCRIPTION_LENGTH } from "../../diagram/schema";
import { boundaryIcon, unnamedBoundary } from "../canvas/toolbar/boundaryCatalog";
import { getComponentDefinition } from "../canvas/toolbar/componentCatalog";
import { iconFor } from "../icons";
import { removeSelected, setConnectionLabel, setDescription, setIcon, setLabel, setTags } from "../state";
import { BoundaryKindField, Containment, GroupInto } from "./BoundaryFields";
import { ComponentDetails } from "./ComponentDetails";
import { ConnectionOptions } from "./ConnectionOptions";
import { IconPicker } from "./IconPicker";
import { field, sectionHeading } from "./styles";
import { TagEditor } from "./TagEditor";
import { useSelectedConnections, useSelectedObjects } from "./useSelection";

const shapes: Record<Exclude<DiagramObject["type"], "component" | "boundary">, { label: string; icon: LucideIcon }> = {
  text: { label: "Text", icon: Type },
  rectangle: { label: "Rectangle", icon: Square },
  sphere: { label: "Sphere", icon: Circle },
};

interface HeaderProps {
  icon: LucideIcon;
  title: string;
  caption: string;
  onIconClick?: () => void;
  iconPickerOpen?: boolean;
}

function Header({ icon: Icon, title, caption, onIconClick, iconPickerOpen }: HeaderProps) {
  const tile = "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent";
  return (
    <header className="flex items-center gap-3 border-b border-line p-4">
      {onIconClick ? (
        <button
          type="button"
          aria-label="Change icon"
          aria-expanded={iconPickerOpen}
          title="Change icon"
          onClick={onIconClick}
          className={`${tile} transition-shadow hover:ring-2 hover:ring-accent/30 ${iconPickerOpen ? "ring-2 ring-accent/50" : ""}`}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ) : (
        <span className={tile}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
      )}
      <div className="min-w-0">
        <h3 className="truncate font-medium">{title}</h3>
        <p className="text-xs text-muted">{caption}</p>
      </div>
    </header>
  );
}

function Layout({
  children,
  deleteLabel,
  onDelete,
}: {
  children: ReactNode;
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <footer className="border-t border-line p-3">
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-red-600 hover:text-white"
        >
          <Trash2 size={14} />
          {deleteLabel}
        </button>
      </footer>
    </>
  );
}

export function PropertiesTab() {
  const objects = useSelectedObjects();
  const connections = useSelectedConnections();
  const count = objects.length + connections.length;

  if (count === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-muted">
        <MousePointerClick size={22} strokeWidth={1.5} />
        <p>Select something on the canvas to see its properties.</p>
      </div>
    );
  }

  if (count > 1) {
    const things = connections.length === 0 ? "nodes" : objects.length === 0 ? "connections" : "items";
    return (
      <Layout deleteLabel={`Delete ${count} ${things}`} onDelete={removeSelected}>
        <Header icon={Shapes} title={`${count} ${things} selected`} caption="Select one to edit it" />
        {objects.length > 1 && <GroupInto />}
      </Layout>
    );
  }

  const [connection] = connections;
  if (connection) {
    return (
      <Layout deleteLabel="Delete" onDelete={removeSelected}>
        <Header icon={MoveRight} title="Connection" caption="Line between two nodes" />
        <label className="block p-4">
          <span className={`block ${sectionHeading}`}>Label</span>
          <input
            value={connection.label}
            placeholder="e.g. HTTPS"
            onChange={(event) => setConnectionLabel(connection.id, event.target.value)}
            className={field}
          />
        </label>
        <div className="border-t border-line p-4">
          <ConnectionOptions connection={connection} />
        </div>
      </Layout>
    );
  }

  const [object] = objects;
  return <ObjectProperties key={object.id} object={object} />;
}

function ObjectProperties({ object }: { object: DiagramObject }) {
  const [pickingIcon, setPickingIcon] = useState(false);
  const nameId = useId();

  if (object.type === "text") {
    return (
      <Layout deleteLabel="Delete" onDelete={removeSelected}>
        <Header icon={shapes.text.icon} title={shapes.text.label} caption="Shape" />
        <Containment object={object} />
        <label className="block p-4">
          <span className={`block ${sectionHeading}`}>Text</span>
          <textarea
            rows={3}
            value={object.text}
            onChange={(event) => setLabel(object.id, event.target.value)}
            className={`${field} resize-none`}
          />
        </label>
      </Layout>
    );
  }

  const definition = object.type === "component" ? getComponentDefinition(object.kind) : undefined;
  const boundary = object.type === "boundary" ? object : undefined;
  const shape = object.type === "rectangle" || object.type === "sphere" ? shapes[object.type] : undefined;
  const fallback = definition?.icon ?? shape?.icon ?? boundaryIcon(boundary?.kind);

  return (
    <Layout deleteLabel={boundary ? "Delete boundary, keep contents" : "Delete"} onDelete={removeSelected}>
      <Header
        icon={iconFor(object.icon, fallback)}
        title={definition?.label ?? shape?.label ?? (boundary?.kind ? boundaryKinds[boundary.kind].label : "Boundary")}
        caption={definition ? "Component" : shape ? "Shape" : boundary?.kind ? "Boundary" : "No kind set"}
        onIconClick={() => setPickingIcon(!pickingIcon)}
        iconPickerOpen={pickingIcon}
      />
      <Containment object={object} />
      {pickingIcon && (
        <div className="border-b border-line p-3">
          <IconPicker value={object.icon} fallback={fallback} onChange={(icon) => setIcon(object.id, icon)} />
        </div>
      )}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <label htmlFor={nameId} className={`block ${sectionHeading}`}>
            Name
          </label>
          {object.type === "component" || object.type === "boundary" ? (
            <input
              id={nameId}
              value={object.name}
              placeholder={boundary ? unnamedBoundary(boundary.kind) : "Untitled"}
              onChange={(event) => setLabel(object.id, event.target.value)}
              className={field}
            />
          ) : (
            <textarea
              id={nameId}
              rows={2}
              value={object.text}
              onChange={(event) => setLabel(object.id, event.target.value)}
              className={`${field} resize-none`}
            />
          )}
        </div>
        <label className="block">
          <span className={`block ${sectionHeading}`}>Description</span>
          <textarea
            rows={2}
            maxLength={DESCRIPTION_LENGTH}
            value={object.description ?? ""}
            placeholder={boundary ? "What it holds (optional)" : "What it is responsible for (optional)"}
            onChange={(event) => setDescription(object.id, event.target.value)}
            className={`${field} resize-none text-[13px]`}
          />
        </label>
      </div>
      {boundary && (
        <div className="border-t border-line p-4">
          <h4 className={sectionHeading}>Kind</h4>
          <BoundaryKindField id={boundary.id} kind={boundary.kind} />
        </div>
      )}
      {object.type === "component" && definition && definition.options.length > 0 && (
        <div className="border-t border-line p-4">
          <h4 className={sectionHeading}>Details</h4>
          <ComponentDetails id={object.id} kind={object.kind} options={object.options} structure={object.structure} />
        </div>
      )}
      <div className="border-t border-line p-4">
        <h4 className={sectionHeading}>Tags</h4>
        <TagEditor tags={object.tags ?? []} onChange={(tags) => setTags(object.id, tags)} />
      </div>
    </Layout>
  );
}
