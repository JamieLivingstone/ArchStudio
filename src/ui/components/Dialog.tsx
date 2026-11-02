import { type ReactNode, useEffect, useRef } from "react";

interface DialogProps {
  open?: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

export function Dialog({ open = true, onClose, labelledBy, className = "", children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
      dialog?.focus();
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click mirrors Escape, which <dialog> handles itself
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onClose={onClose}
      // The dialog has no padding, so a click that lands on it is on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`floating m-auto max-w-[calc(100%-2rem)] rounded-2xl p-0 text-sm outline-none text-fg backdrop:bg-black/30 ${className}`}
    >
      {children}
    </dialog>
  );
}
