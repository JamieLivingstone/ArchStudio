import { Dialog } from "../components/Dialog";

interface UpdateDialogProps {
  version: string;
  installing: boolean;
  error: string;
  onInstall: () => void;
  onLater: () => void;
}

const button = "rounded-lg px-3 py-1.5 text-xs font-medium";

export function UpdateDialog({ version, installing, error, onInstall, onLater }: UpdateDialogProps) {
  return (
    <Dialog onClose={onLater} labelledBy="update-title" className="w-96 select-none">
      <div className="p-5">
        <h2 id="update-title" className="text-base font-medium">
          ArchStudio {version} is available
        </h2>
        <p className="mt-1 text-muted">Installing it restarts the app.</p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onLater}
            disabled={installing}
            className={`${button} text-muted hover:bg-hover hover:text-fg disabled:opacity-35`}
          >
            Later
          </button>
          <button
            type="button"
            onClick={onInstall}
            disabled={installing}
            className={`${button} bg-accent text-surface hover:opacity-90 disabled:opacity-35`}
          >
            {installing ? "Installing…" : "Install and restart"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
