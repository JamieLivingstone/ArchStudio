import { FilePlus, FolderOpen, LoaderCircle, type LucideIcon, MonitorDown, X } from "lucide-react";
import { useRef, useState } from "react";
import { repository } from "../../../package.json";
import { type Diagram, emptyDiagram } from "../../diagram/schema";
import { fileName, hasNativeFiles, pickDiagramFile } from "../../tauri/diagramFiles";
import { isDesktop } from "../../tauri/providers";
import { Dialog } from "../components/Dialog";
import { IconButton } from "../components/IconButton";
import { Link } from "../components/Link";
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

const link =
  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-fg";

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
          <div className="-ml-2 mt-2 flex flex-wrap gap-1 md:mt-auto">
            {!isDesktop() && (
              <Link href={`${repository}/releases/latest`} className={link}>
                <MonitorDown size={16} strokeWidth={1.75} />
                Get the desktop app
              </Link>
            )}
            <Link href={repository} className={link}>
              <svg aria-hidden="true" viewBox="0 0 16 16" width={16} height={16} fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Open source on GitHub
            </Link>
          </div>
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
