import { Dialog } from "../components/Dialog";

interface UnsavedDialogProps {
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

const button = "rounded-lg px-3 py-1.5 text-xs font-medium";

export function UnsavedDialog({ fileName, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  return (
    <Dialog onClose={onCancel} labelledBy="unsaved-title" className="w-96 select-none">
      <div className="p-5">
        <h2 id="unsaved-title" className="text-base font-medium">
          Save changes to {fileName}?
        </h2>
        <p className="mt-1 text-muted">Your changes will be lost if you do not save them.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onDiscard} className={`${button} text-red-500 hover:bg-red-500/10`}>
            Discard
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onCancel} className={`${button} text-muted hover:bg-hover hover:text-fg`}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className={`${button} bg-accent text-surface hover:opacity-90`}>
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
}
