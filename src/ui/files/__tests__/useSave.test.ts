import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { shape } from "../../../test/diagram";
import { addObject, getAppState, loadDiagram } from "../../state";
import { saveDiagram } from "../saveDiagram";
import { useSave } from "../useSave";

vi.mock("../saveDiagram", () => ({ saveDiagram: vi.fn(async () => "saved") }));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

test("saves the diagram", async () => {
  const { result } = renderHook(() => useSave());
  await act(() => result.current.save());
  expect(saveDiagram).toHaveBeenCalledTimes(1);
  expect(result.current.saveError).toBe("");
});

test("a failed save is reported until it is cleared or a save succeeds", async () => {
  vi.mocked(saveDiagram).mockRejectedValue(new Error("Disk full"));
  const { result } = renderHook(() => useSave());
  await act(() => result.current.save());
  expect(result.current.saveError).toBe("Could not save. Disk full");

  act(() => result.current.clearSaveError());
  expect(result.current.saveError).toBe("");

  await act(() => result.current.save());
  vi.mocked(saveDiagram).mockResolvedValue("saved");
  await act(() => result.current.save());
  expect(result.current.saveError).toBe("");
});

test("a diagram with a file on disk is saved a moment after it changes", () => {
  vi.useFakeTimers();
  renderHook(() => useSave());
  act(() => loadDiagram(getAppState().diagram, { name: "orders.json", path: "/designs/orders.json" }));
  act(() => addObject(shape("note", "Note", "text"), "Add text"));
  expect(saveDiagram).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(saveDiagram).toHaveBeenCalledTimes(1);
});

test("a diagram with no file on disk is not saved on its own", () => {
  vi.useFakeTimers();
  renderHook(() => useSave());
  act(() => addObject(shape("note", "Note", "text"), "Add text"));
  act(() => vi.advanceTimersByTime(5000));
  expect(saveDiagram).not.toHaveBeenCalled();
});

test("says whether it was saved: not when the user backs out, or when it fails", async () => {
  const { result } = renderHook(() => useSave());
  const saved = async () => {
    let outcome = false;
    await act(async () => {
      outcome = await result.current.save();
    });
    return outcome;
  };
  vi.mocked(saveDiagram).mockResolvedValueOnce("saved");
  expect(await saved()).toBe(true);
  vi.mocked(saveDiagram).mockResolvedValueOnce("cancelled");
  expect(await saved()).toBe(false);
  vi.mocked(saveDiagram).mockRejectedValueOnce(new Error("Disk full"));
  expect(await saved()).toBe(false);
});
