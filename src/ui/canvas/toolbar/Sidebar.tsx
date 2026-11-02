import { Panel } from "@xyflow/react";
import {
  Circle,
  Hand,
  LayoutGrid,
  type LucideIcon,
  MousePointer2,
  Settings,
  Square,
  SquareDashed,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NewDiagramObject } from "../../../diagram/schema";
import { IconButton } from "../../components/IconButton";
import { useAddNode } from "../hooks/useAddNode";
import { isAddClick, useDragToAdd } from "../hooks/useDragToAdd";
import { BoundaryPicker } from "./BoundaryPicker";
import { ComponentPicker } from "./ComponentPicker";

export type CanvasTool = "move" | "select";

const tools: { value: CanvasTool; title: string; description: string; icon: LucideIcon }[] = [
  { value: "move", title: "Move", description: "Drag to move the canvas (H)", icon: Hand },
  {
    value: "select",
    title: "Select",
    description: "Drag a box over nodes (V)",
    icon: MousePointer2,
  },
];

const shapes: { title: string; description: string; icon: LucideIcon; node: NewDiagramObject }[] = [
  {
    title: "Text",
    description: "A free-standing label",
    icon: Type,
    node: { type: "text", text: "Text" },
  },
  {
    title: "Rectangle",
    description: "A plain box",
    icon: Square,
    node: { type: "rectangle", text: "" },
  },
  {
    title: "Sphere",
    description: "A plain circle",
    icon: Circle,
    node: { type: "sphere", text: "" },
  },
];

const divider = "mx-1 my-1 border-line";

interface SidebarProps {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ tool, onToolChange, onOpenSettings }: SidebarProps) {
  const addNode = useAddNode();
  const { beginDrag, ghost } = useDragToAdd(addNode);
  const [picker, setPicker] = useState<"boundaries" | "components">();
  const pickerOpen = picker !== undefined;
  const closePicker = () => setPicker(undefined);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !railRef.current?.contains(event.target)) {
        setPicker(undefined);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPicker(undefined);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  return (
    <Panel position="top-left" className="nopan z-10!">
      <nav ref={railRef} aria-label="Tools" className="floating flex select-none flex-col gap-0.5 rounded-xl p-1.5">
        {tools.map(({ value, title, ...button }) => (
          <IconButton
            key={value}
            label={title}
            {...button}
            tooltip="right"
            active={tool === value}
            aria-pressed={tool === value}
            onClick={() => onToolChange(value)}
          />
        ))}
        <hr className={divider} />
        {shapes.map((shape) => (
          <IconButton
            key={shape.title}
            label={shape.title}
            description={shape.description}
            icon={shape.icon}
            tooltip="right"
            onClick={(event) => {
              if (isAddClick(event)) addNode(shape.node);
            }}
            onPointerDown={(event) => beginDrag(event, shape)}
          />
        ))}
        <hr className={divider} />
        <IconButton
          label="Boundaries"
          description="Services, teams, domains and zones"
          icon={SquareDashed}
          tooltip={pickerOpen ? undefined : "right"}
          active={picker === "boundaries"}
          aria-expanded={picker === "boundaries"}
          onClick={() => setPicker(picker === "boundaries" ? undefined : "boundaries")}
        >
          {picker === "boundaries" && (
            <div className="absolute -top-1.5 left-full ml-3.5">
              <BoundaryPicker onAdd={addNode} onDragStart={beginDrag} />
            </div>
          )}
        </IconButton>
        <IconButton
          label="Components"
          description="Services, data stores and more"
          icon={LayoutGrid}
          tooltip={pickerOpen ? undefined : "right"}
          active={picker === "components"}
          aria-expanded={picker === "components"}
          onClick={() => setPicker(picker === "components" ? undefined : "components")}
        >
          {picker === "components" && (
            <div className="absolute -top-1.5 left-full ml-3.5">
              <ComponentPicker onAdd={addNode} onDragStart={beginDrag} />
            </div>
          )}
        </IconButton>
        <hr className={divider} />
        <IconButton
          label="Settings"
          description="Appearance and models"
          icon={Settings}
          tooltip="right"
          onClick={() => {
            closePicker();
            onOpenSettings();
          }}
        />
      </nav>
      {ghost}
    </Panel>
  );
}
