import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { parseDiagram } from "../../../diagram/parse";
import { hasNativeFiles, writeDiagramFile } from "../../../tauri/diagramFiles";
import { component, diagram, seed } from "../../../test/diagram";
import { getAppState, hasUnsavedChanges, loadDiagram, setLabel } from "../../state";
import { saveDiagram } from "../saveDiagram";

vi.mock("../../../tauri/diagramFiles", () => ({
  fileName: (path: string) => path.split("/").pop() ?? path,
  hasNativeFiles: vi.fn(),
  writeDiagramFile: vi.fn(),
}));

const unsaved = () => hasUnsavedChanges(getAppState());

beforeEach(() => {
  seed([component("api", "API")]);
  setLabel("api", "Orders API");
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

test("the desktop app asks where the first time, then writes to the same file", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  vi.mocked(writeDiagramFile).mockResolvedValue("/designs/orders.json");
  expect(unsaved()).toBe(true);

  await saveDiagram();
  const [text, path] = vi.mocked(writeDiagramFile).mock.calls[0];
  expect(parseDiagram(text)).toEqual({ diagram: diagram() });
  expect(path).toBeUndefined();
  expect(getAppState().file).toEqual({ name: "orders.json", path: "/designs/orders.json" });
  expect(unsaved()).toBe(false);

  await saveDiagram();
  expect(vi.mocked(writeDiagramFile).mock.calls[1][1]).toBe("/designs/orders.json");
});

test("a diagram with a name but no file yet offers that name when saved", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  loadDiagram(diagram(), { name: "Real-time chat.json" });
  await saveDiagram();
  expect(vi.mocked(writeDiagramFile).mock.calls[0].slice(1)).toEqual([undefined, "Real-time chat.json"]);
});

test("saving as another file asks where even when the diagram has a file", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  vi.mocked(writeDiagramFile).mockResolvedValue("/designs/copy.json");
  loadDiagram(diagram(), { name: "orders.json", path: "/designs/orders.json" });

  await saveDiagram({ as: true });
  expect(vi.mocked(writeDiagramFile).mock.calls[0][1]).toBeUndefined();
  expect(getAppState().file).toEqual({ name: "copy.json", path: "/designs/copy.json" });
});

test("cancelling the desktop save leaves the changes unsaved", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  vi.mocked(writeDiagramFile).mockResolvedValue(undefined);
  await saveDiagram();
  expect(unsaved()).toBe(true);
  expect(getAppState().file).toBeUndefined();
});

test("a browser downloads the diagram under its file's name", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(false);
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:diagram";
  });
  URL.revokeObjectURL = vi.fn();
  const downloads: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });

  await saveDiagram();
  expect(downloads).toEqual(["Untitled.json"]);
  expect(parseDiagram(await blobs[0].text())).toEqual({ diagram: diagram() });
  expect(unsaved()).toBe(false);

  loadDiagram(diagram(), { name: "orders.json" });
  await saveDiagram();
  expect(downloads).toEqual(["Untitled.json", "orders.json"]);
});

const notStarted = () => {};

function slowWrite(path: string) {
  let finish = notStarted;
  vi.mocked(writeDiagramFile).mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve(path))));
  return async () => {
    await vi.waitFor(() => expect(finish).not.toBe(notStarted));
    finish();
  };
}

test("a save that finishes after another diagram was loaded leaves that diagram alone", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  const finish = slowWrite("/A.json");
  const saving = saveDiagram();
  await vi.waitFor(() => expect(writeDiagramFile).toHaveBeenCalled());

  seed([component("other", "Other")]);
  loadDiagram(diagram(), { name: "B.json", path: "/B.json" });
  await finish();
  await saving;
  expect(getAppState().file).toEqual({ name: "B.json", path: "/B.json" });
  expect(unsaved()).toBe(false);
});

test("an autosave already under way cannot put the diagram back at its old file after Save as", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  loadDiagram(diagram(), { name: "A.json", path: "/A.json" });
  setLabel("api", "Changed");
  const finishAutosave = slowWrite("/A.json");
  const autosave = saveDiagram();
  vi.mocked(writeDiagramFile).mockResolvedValueOnce("/copy.json");
  const saveAs = saveDiagram({ as: true });
  await finishAutosave();
  await Promise.all([autosave, saveAs]);
  expect(getAppState().file?.path).toBe("/copy.json");
  expect(vi.mocked(writeDiagramFile).mock.calls.map(([, path]) => path)).toEqual(["/A.json", undefined]);
});

test("a save that fails does not stop the next one", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  vi.mocked(writeDiagramFile).mockRejectedValueOnce(new Error("Disk full")).mockResolvedValueOnce("/A.json");
  await expect(saveDiagram()).rejects.toThrow("Disk full");
  await saveDiagram();
  expect(unsaved()).toBe(false);
});

test("a save asked for one diagram is not carried out on another loaded while it waited its turn", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  const finish = slowWrite("/A.json");
  const first = saveDiagram();
  const saveAs = saveDiagram({ as: true });
  await vi.waitFor(() => expect(writeDiagramFile).toHaveBeenCalled());

  seed([component("other", "Other")]);
  loadDiagram(diagram(), { name: "B.json", path: "/B.json" });
  await finish();
  await first;
  expect(await saveAs).toBe("cancelled");
  expect(writeDiagramFile).toHaveBeenCalledTimes(1);
  expect(getAppState().file).toEqual({ name: "B.json", path: "/B.json" });
});
