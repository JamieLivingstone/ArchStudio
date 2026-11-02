import { useEffect, useRef } from "react";
import { fileName, listenForDroppedFile, readDiagramFile } from "../../tauri/diagramFiles";
import type { DiagramFile } from "../state";

export function useFileDrop(onOpen: (text: string, file: DiagramFile) => void, onFail: (cause: unknown) => void) {
  const latest = useRef({ onOpen, onFail });
  useEffect(() => {
    latest.current = { onOpen, onFail };
  });

  useEffect(() => {
    const failed = (cause: unknown) => latest.current.onFail(cause);

    // Left alone, a browser would leave the app to show the file.
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      const file = event.dataTransfer?.files[0];
      if (!file) return;
      event.preventDefault();
      file
        .text()
        .then((text) => latest.current.onOpen(text, { name: file.name }))
        .catch(failed);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);

    // The desktop app's webview gets no drop events: the window reports the path instead.
    const stopListening = listenForDroppedFile((path) => {
      readDiagramFile(path)
        .then((text) => latest.current.onOpen(text, { name: fileName(path), path }))
        .catch(failed);
    });

    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      stopListening();
    };
  }, []);
}
