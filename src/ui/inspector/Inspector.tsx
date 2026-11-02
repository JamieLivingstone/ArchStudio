import { Panel } from "@xyflow/react";
import { PanelRight, X } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../components/IconButton";
import type { ModelSelection } from "../settings/useModelSelection";
import { hasCommandKey, useKeyDown } from "../useKeyDown";
import { AssistantTab } from "./AssistantTab";
import { PropertiesTab } from "./PropertiesTab";
import { useSelectedConnections, useSelectedObjects } from "./useSelection";

type Tab = "properties" | "assistant";

const tabs: { value: Tab; label: string }[] = [
  { value: "properties", label: "Properties" },
  { value: "assistant", label: "Assistant" },
];

interface InspectorProps {
  modelSelection: ModelSelection;
  onOpenSettings: () => void;
}

export function Inspector({ modelSelection, onOpenSettings }: InspectorProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("assistant");
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [openedBySelection, setOpenedBySelection] = useState(false);

  const selection = [...useSelectedObjects(), ...useSelectedConnections()].map((item) => item.id).join("\n");
  const [lastSelection, setLastSelection] = useState(selection);
  if (selection !== lastSelection) {
    setLastSelection(selection);
    if (selection && !open) {
      setOpen(true);
      setTab("properties");
      setOpenedBySelection(true);
    } else if (!selection && openedBySelection) {
      setOpen(false);
      setOpenedBySelection(false);
    }
  }

  function show(next: Tab) {
    setOpenedBySelection(false);
    setTab(next);
    setOpen(true);
  }

  function close() {
    setOpenedBySelection(false);
    setOpen(false);
  }

  const assistantShown = open && tab === "assistant";
  useKeyDown((event) => {
    if (!hasCommandKey(event) || event.key.toLowerCase() !== "j") return;
    event.preventDefault();
    if (assistantShown) close();
    else show("assistant");
  });

  return (
    <>
      <Panel position="top-right" className="nopan floating rounded-xl p-1.5" aria-hidden={open} inert={open}>
        <IconButton label="Show panel" icon={PanelRight} onClick={() => show(tab)} />
      </Panel>

      <Panel
        position="top-right"
        data-inspector
        aria-hidden={!open}
        inert={!open}
        className={`nopan floating flex h-[calc(100%-30px)] w-80 select-none max-w-[calc(100%-30px)] origin-top-right flex-col rounded-xl text-sm text-fg transition-[opacity,scale,visibility] duration-200 ease-out motion-reduce:transition-none ${
          open ? "scale-100 opacity-100" : "invisible pointer-events-none scale-95 opacity-0"
        }`}
      >
        <aside
          aria-label="Inspector"
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <header className="flex items-center gap-1 border-b border-line p-1.5">
            <div role="tablist" className="flex flex-1 gap-0.5">
              {tabs.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => show(value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-hover hover:text-fg ${
                    tab === value
                      ? "bg-hover font-medium text-fg"
                      : // Properties is fainter while there is nothing selected to show.
                        value === "properties" && !selection
                        ? "text-muted/60"
                        : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div ref={setHeaderSlot} className="flex" />
            <IconButton label="Hide panel" icon={X} onClick={close} />
          </header>

          {tabs.map(({ value, label }) => (
            <div
              key={value}
              role="tabpanel"
              aria-label={label}
              hidden={tab !== value}
              className={tab === value ? "flex min-h-0 flex-1 flex-col" : "hidden"}
            >
              {value === "properties" && <PropertiesTab />}
              {value === "assistant" && (
                <AssistantTab
                  active={assistantShown}
                  headerSlot={headerSlot}
                  onShowProperties={() => show("properties")}
                  modelSelection={modelSelection}
                  onOpenSettings={onOpenSettings}
                />
              )}
            </div>
          ))}
        </aside>
      </Panel>
    </>
  );
}
