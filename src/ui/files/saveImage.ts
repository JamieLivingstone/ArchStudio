import { hasNativeFiles, writeImageFile } from "../../tauri/diagramFiles";
import { download } from "./saveDiagram";

export async function saveImage(image: Blob, name: string) {
  if (hasNativeFiles()) await writeImageFile(new Uint8Array(await image.arrayBuffer()), name);
  else download(name, image);
}
