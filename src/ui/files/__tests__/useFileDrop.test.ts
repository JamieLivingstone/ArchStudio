import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { listenForDroppedFile, readDiagramFile } from "../../../tauri/diagramFiles";
import { useFileDrop } from "../useFileDrop";

vi.mock("../../../tauri/diagramFiles", () => ({
  fileName: (path: string) => path.split("/").pop() ?? path,
  listenForDroppedFile: vi.fn(() => () => {}),
  readDiagramFile: vi.fn(async () => "{}"),
}));

afterEach(() => vi.clearAllMocks());

function setup() {
  const onOpen = vi.fn();
  const onFail = vi.fn();
  const view = renderHook(() => useFileDrop(onOpen, onFail));
  return { ...view, onOpen, onFail };
}

function dragEvent(type: string, dataTransfer: unknown) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  window.dispatchEvent(event);
  return event;
}

const dropped = (text: string) => new File([text], "orders.json");

test("a file dropped in a browser is read and opened, and the browser does not navigate to it", async () => {
  const { onOpen } = setup();
  expect(dragEvent("dragover", { types: ["Files"] }).defaultPrevented).toBe(true);
  expect(dragEvent("drop", { files: [dropped("{}")] }).defaultPrevented).toBe(true);
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("{}", { name: "orders.json" }));
});

test("dragged text is left alone", () => {
  const { onOpen } = setup();
  expect(dragEvent("dragover", { types: ["text/plain"] }).defaultPrevented).toBe(false);
  expect(dragEvent("drop", { files: [] }).defaultPrevented).toBe(false);
  expect(onOpen).not.toHaveBeenCalled();
});

test("a file dropped on the desktop app keeps its path, so it saves back to the same place", async () => {
  const { onOpen } = setup();
  const [report] = vi.mocked(listenForDroppedFile).mock.calls[0];
  report("/designs/orders.json");
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("{}", { name: "orders.json", path: "/designs/orders.json" }));
});

test("a file that cannot be read says why", async () => {
  const denied = new Error("Permission denied.");
  vi.mocked(readDiagramFile).mockRejectedValueOnce(denied);
  const { onFail } = setup();
  vi.mocked(listenForDroppedFile).mock.calls[0][0]("/designs/orders.json");
  await waitFor(() => expect(onFail).toHaveBeenCalledWith(denied));
});

test("stops listening when it goes", () => {
  const stop = vi.fn();
  vi.mocked(listenForDroppedFile).mockReturnValueOnce(stop);
  const { unmount, onOpen } = setup();
  unmount();
  expect(stop).toHaveBeenCalled();
  dragEvent("drop", { files: [dropped("{}")] });
  expect(onOpen).not.toHaveBeenCalled();
});
