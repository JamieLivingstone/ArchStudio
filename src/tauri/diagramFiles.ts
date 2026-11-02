import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";

const filters = [{ name: "Diagram", extensions: ["json"] }];

export const hasNativeFiles = () => isTauri();

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export async function pickDiagramFile(): Promise<{ path: string; text: string } | undefined> {
  const path = await open({ filters, multiple: false });
  return path ? { path, text: await readTextFile(path) } : undefined;
}

export const readDiagramFile = (path: string) => readTextFile(path);

export function listenForDroppedFile(onDrop: (path: string) => void): () => void {
  if (!isTauri()) return () => {};
  const listening = getCurrentWebview().onDragDropEvent(({ payload }) => {
    if (payload.type === "drop" && payload.paths[0]) onDrop(payload.paths[0]);
  });
  return () => {
    listening.then((stop) => stop());
  };
}

export async function writeImageFile(image: Uint8Array, name: string) {
  const path = await save({ filters: [{ name: "PNG image", extensions: ["png"] }], defaultPath: name });
  if (path) await writeFile(path, image);
}

export async function writeDiagramFile(
  text: string,
  path?: string,
  name = "Untitled.json",
): Promise<string | undefined> {
  const target = path ?? (await save({ filters, defaultPath: name }));
  if (!target) return undefined;
  await invoke("write_diagram_file", { path: target, text });
  return target;
}
