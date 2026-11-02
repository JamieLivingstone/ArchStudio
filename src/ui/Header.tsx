import { House, Save } from "lucide-react";
import { ExportButton } from "./files/ExportButton";
import { hasUnsavedChanges, useAppState } from "./state";

interface HeaderProps {
  error: string;
  onError: (message: string) => void;
  onSave: () => void;
  onHome: () => void;
}

const action =
  "flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-muted transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-35";

export function Header({ error, onError, onSave, onHome }: HeaderProps) {
  const fileName = useAppState((state) => state.file?.name);
  const unsaved = useAppState(hasUnsavedChanges);

  return (
    <header
      data-tauri-drag-region
      className="relative flex h-10 shrink-0 select-none items-center justify-center border-b border-line bg-surface text-[13px] font-medium text-muted"
    >
      {error ? (
        <span role="alert" className="pointer-events-none text-red-500">
          {error}
        </span>
      ) : (
        <span className="pointer-events-none">
          {fileName ?? "Untitled"}
          {unsaved && " · Edited"}
        </span>
      )}
      <div className="absolute right-1.5 flex gap-0.5">
        <button type="button" onClick={onHome} className={action}>
          <House size={14} strokeWidth={1.75} />
          Home
        </button>
        <button type="button" onClick={onSave} className={action}>
          <Save size={14} strokeWidth={1.75} />
          Save
        </button>
        <ExportButton className={action} onError={onError} />
      </div>
    </header>
  );
}
