import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { afterEach, expect, test, vi } from "vitest";
import { listenForDroppedFile, pickDiagramFile, writeDiagramFile, writeImageFile } from "../diagramFiles";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readTextFile: vi.fn(), writeFile: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => webview }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(), invoke: vi.fn() }));

const webview = vi.hoisted(() => ({ onDragDropEvent: vi.fn() }));

afterEach(() => vi.resetAllMocks());

test("an image is written where the save dialog says", async () => {
  vi.mocked(save).mockResolvedValue("/designs/orders.png");
  const image = new Uint8Array([1]);
  await writeImageFile(image, "orders.png");
  expect(save).toHaveBeenCalledWith({
    filters: [{ name: "PNG image", extensions: ["png"] }],
    defaultPath: "orders.png",
  });
  expect(writeFile).toHaveBeenCalledWith("/designs/orders.png", image);
});

test("cancelling the save dialog writes no image", async () => {
  vi.mocked(save).mockResolvedValue(null);
  await writeImageFile(new Uint8Array([1]), "orders.png");
  expect(writeFile).not.toHaveBeenCalled();
});

test("only a finished drop on the desktop app reports a file, the first of them", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  const stop = vi.fn();
  webview.onDragDropEvent.mockResolvedValue(stop);
  const onDrop = vi.fn();
  const stopListening = listenForDroppedFile(onDrop);
  const [report] = webview.onDragDropEvent.mock.calls[0];
  report({ payload: { type: "over", position: { x: 0, y: 0 } } });
  expect(onDrop).not.toHaveBeenCalled();
  report({ payload: { type: "drop", paths: ["/a.json", "/b.json"], position: { x: 0, y: 0 } } });
  expect(onDrop).toHaveBeenCalledWith("/a.json");
  stopListening();
  await vi.waitFor(() => expect(stop).toHaveBeenCalled());
});

test("a browser has no native drops to listen for", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  listenForDroppedFile(vi.fn())();
  expect(webview.onDragDropEvent).not.toHaveBeenCalled();
});

test("picking a file reads it", async () => {
  vi.mocked(open).mockResolvedValue("/designs/orders.json");
  vi.mocked(readTextFile).mockResolvedValue("{}");
  expect(await pickDiagramFile()).toEqual({ path: "/designs/orders.json", text: "{}" });
});

test("cancelling the picker reads nothing", async () => {
  vi.mocked(open).mockResolvedValue(null);
  expect(await pickDiagramFile()).toBeUndefined();
  expect(readTextFile).not.toHaveBeenCalled();
});

test("writing to a known path does not ask where", async () => {
  expect(await writeDiagramFile("{}", "/designs/orders.json")).toBe("/designs/orders.json");
  expect(save).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledWith("write_diagram_file", { path: "/designs/orders.json", text: "{}" });
});

test("the save dialog suggests the diagram's name, or Untitled", async () => {
  await writeDiagramFile("{}", undefined, "Real-time chat.json");
  await writeDiagramFile("{}");
  expect(vi.mocked(save).mock.calls.map(([options]) => options?.defaultPath)).toEqual([
    "Real-time chat.json",
    "Untitled.json",
  ]);
});

test("writing without a path asks where, and writes nothing if cancelled", async () => {
  vi.mocked(save).mockResolvedValueOnce("/designs/new.json").mockResolvedValueOnce(null);
  expect(await writeDiagramFile("{}")).toBe("/designs/new.json");
  expect(invoke).toHaveBeenCalledWith("write_diagram_file", { path: "/designs/new.json", text: "{}" });

  expect(await writeDiagramFile("{}")).toBeUndefined();
  expect(invoke).toHaveBeenCalledTimes(1);
});
