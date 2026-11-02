import { useEffect, useRef, useState } from "react";
import { hasNativeFiles } from "../../tauri/diagramFiles";
import { closeWindow, interceptWindowClose } from "../../tauri/window";
import { getAppState, hasUnsavedChanges } from "../state";

const unsavedNow = () => hasUnsavedChanges(getAppState());

export function useUnsavedGuard(saveNow: () => Promise<boolean>) {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const latest = useRef(pending);
  latest.current = pending;

  useEffect(() => interceptWindowClose(unsavedNow, () => setPending(() => closeWindow)), []);

  useEffect(() => {
    if (hasNativeFiles()) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (unsavedNow()) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function askFirst(action: () => void) {
    if (unsavedNow()) setPending(() => action);
    else action();
  }

  function discard() {
    setPending(null);
    pending?.();
  }

  async function save() {
    const asked = pending;
    const saved = await saveNow();
    if (latest.current !== asked) return;
    if (!saved) setPending(null);
    else if (!unsavedNow()) discard();
  }

  return { askFirst, asking: pending !== null, save, discard, cancel: () => setPending(null) };
}
