import { serializeDiagram } from "../../diagram/parse";
import { fileName, hasNativeFiles, writeDiagramFile } from "../../tauri/diagramFiles";
import { getAppState, markSaved } from "../state";

export function download(name: string, contents: Blob) {
  const url = URL.createObjectURL(contents);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type SaveOutcome = "saved" | "cancelled";

async function save(as: boolean, documentId: number): Promise<SaveOutcome> {
  const { diagram, file } = getAppState();
  if (getAppState().documentId !== documentId) return "cancelled";
  const text = serializeDiagram(diagram);
  if (!hasNativeFiles()) {
    const name = file?.name ?? "Untitled.json";
    download(name, new Blob([text], { type: "application/json" }));
    markSaved(diagram, { name });
    return "saved";
  }
  const path = await writeDiagramFile(text, as ? undefined : file?.path, file?.name);
  if (path && getAppState().documentId === documentId) markSaved(diagram, { name: fileName(path), path });
  return path ? "saved" : "cancelled";
}

// One save at a time, in order, so an autosave cannot land after saving a copy.
let saving: Promise<unknown> = Promise.resolve();

export function saveDiagram({ as = false } = {}): Promise<SaveOutcome> {
  const { documentId } = getAppState();
  const next = saving.then(() => save(as, documentId));
  saving = next.catch(() => {});
  return next;
}
