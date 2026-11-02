import { afterEach, expect, test, vi } from "vitest";
import { hasNativeFiles, writeImageFile } from "../../../tauri/diagramFiles";
import { download } from "../saveDiagram";
import { saveImage } from "../saveImage";

vi.mock("../../../tauri/diagramFiles", () => ({ hasNativeFiles: vi.fn(() => false), writeImageFile: vi.fn() }));
vi.mock("../saveDiagram", () => ({ download: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasNativeFiles).mockReturnValue(false);
});

const image = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

test("a browser downloads the image", async () => {
  await saveImage(image, "orders.png");
  expect(download).toHaveBeenCalledWith("orders.png", image);
  expect(writeImageFile).not.toHaveBeenCalled();
});

test("the desktop app asks where to save it", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  await saveImage(image, "orders.png");
  expect(writeImageFile).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "orders.png");
  expect(download).not.toHaveBeenCalled();
});
