import { useCallback, useEffect, useState } from "react";
import { reason } from "../errorReason";
import { useAppState } from "../state";
import { saveDiagram } from "./saveDiagram";

const AUTOSAVE_DELAY = 1000;

export function useSave() {
  const [saveError, setSaveError] = useState("");
  const diagram = useAppState((state) => state.diagram);
  const savedDiagram = useAppState((state) => state.savedDiagram);
  const filePath = useAppState((state) => state.file?.path);

  const save = useCallback(async (): Promise<boolean> => {
    setSaveError("");
    try {
      return (await saveDiagram()) === "saved";
    } catch (cause) {
      setSaveError(`Could not save. ${reason(cause)}`);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!filePath || diagram === savedDiagram) return;
    const timer = window.setTimeout(save, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [diagram, savedDiagram, filePath, save]);

  return { save, saveError, clearSaveError: () => setSaveError("") };
}
