import { FilePlus, FolderOpen, LoaderCircle, type LucideIcon, X } from "lucide-react";
import { useRef, useState } from "react";
import { type Diagram, emptyDiagram } from "../../diagram/schema";
import { fileName, hasNativeFiles, pickDiagramFile } from "../../tauri/diagramFiles";
import { Dialog } from "../components/Dialog";
import { IconButton } from "../components/IconButton";
import type { DiagramFile } from "../state";
import { templates } from "./templates";

interface LandingProps {
  onStart: (diagram: Diagram, from?: { file?: DiagramFile; arrange?: boolean }) => void;
  onOpenFile: (text: string, file: DiagramFile) => void;
  onOpenFailed: (cause: unknown) => void;
  onClose: () => void;
  error: string;
  opening?: boolean;
}

function Action({
  icon: Icon,
  name,
  description,
  onClick,
  busy = false,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={busy}
      className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:bg-hover"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {busy ? (
          <LoaderCircle size={16} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <Icon size={16} strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{name}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </button>
  );
}

const categories = [...new Set(templates.map((template) => template.category))];

export function Landing({ onStart, onOpenFile, onOpenFailed, onClose, error, opening = false }: LandingProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<string>();

  async function openNative() {
    try {
      const picked = await pickDiagramFile();
      if (picked) onOpenFile(picked.text, { name: fileName(picked.path), path: picked.path });
    } catch (cause) {
      onOpenFailed(cause);
    }
  }

  return (
    <Dialog
      onClose={onClose}
      labelledBy="landing-title"
      className="max-h-[calc(100%-2rem)] w-240 select-none overflow-hidden open:flex lg:min-h-104"
    >
      <div inert={opening} className="flex min-h-0 w-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-line bg-canvas p-5 md:w-64 md:overflow-y-auto md:border-r md:border-b-0">
          <div className="mb-2 pr-8 md:pr-0">
            <h2 id="landing-title" className="text-base font-medium">
              Welcome to ArchStudio
            </h2>
            <p className="text-muted">Design, understand and review software architecture.</p>
          </div>
          <Action
            icon={FilePlus}
            name="New diagram"
            description="Start with an empty canvas."
            onClick={() => onStart(emptyDiagram())}
          />
          <Action
            icon={FolderOpen}
            name="Open diagram"
            description="Open a diagram file from this device."
            onClick={() => (hasNativeFiles() ? openNative() : fileInput.current?.click())}
          />
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Diagram file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file)
                file
                  .text()
                  .then((text) => onOpenFile(text, { name: file.name }))
                  .catch(onOpenFailed);
            }}
          />
          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <h3 className="px-5 py-3.5 font-medium">Templates</h3>
          <div className="flex flex-1 flex-col gap-6 px-5 pb-5 md:min-h-0 md:overflow-y-auto">
            {categories.map((category) => (
              <section key={category} aria-label={category} className="flex flex-col gap-3">
                <h4 className="text-xs font-medium text-muted">{category}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {templates
                    .filter((template) => template.category === category)
                    .map((template) => (
                      <Action
                        key={template.id}
                        icon={template.icon}
                        name={template.name}
                        description={template.description}
                        onClick={() => {
                          setChosen(template.id);
                          onStart(template.diagram, { file: { name: `${template.name}.json` }, arrange: true });
                        }}
                        busy={opening && chosen === template.id}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
      <div inert={opening} className="absolute top-2 right-2 rounded-lg bg-surface">
        <IconButton label="Close" icon={X} size="sm" onClick={onClose} />
      </div>
    </Dialog>
  );
}
