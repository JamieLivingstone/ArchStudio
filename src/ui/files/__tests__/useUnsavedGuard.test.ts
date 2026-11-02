import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { closeWindow, interceptWindowClose } from "../../../tauri/window";
import { shape } from "../../../test/diagram";
import { addObject, getAppState, markSaved } from "../../state";
import { useUnsavedGuard } from "../useUnsavedGuard";

vi.mock("../../../tauri/window", () => ({
  interceptWindowClose: vi.fn(() => () => {}),
  closeWindow: vi.fn(),
}));
vi.mock("../../../tauri/diagramFiles", () => ({ hasNativeFiles: () => false }));

afterEach(() => vi.clearAllMocks());

const saving = vi.fn(async () => {
  markSaved(getAppState().diagram, { name: "kept.json" });
  return true;
});

const edit = () => act(() => addObject(shape("note", "Note", "text"), "Add text"));

function setup(saveNow = vi.fn(async () => false)) {
  const { result } = renderHook(() => useUnsavedGuard(saveNow));
  return { guard: () => result.current, saveNow, action: vi.fn() };
}

test("with nothing unsaved the action runs straight away", () => {
  const { guard, action } = setup();
  act(() => guard().askFirst(action));
  expect(action).toHaveBeenCalledTimes(1);
  expect(guard().asking).toBe(false);
});

test("with unsaved changes it asks, and Cancel drops the action", () => {
  const { guard, action } = setup();
  edit();
  act(() => guard().askFirst(action));
  expect(guard().asking).toBe(true);

  act(() => guard().cancel());
  expect(guard().asking).toBe(false);
  expect(action).not.toHaveBeenCalled();
});

test("Discard carries on without saving", () => {
  const { guard, action, saveNow } = setup();
  edit();
  act(() => guard().askFirst(action));
  act(() => guard().discard());
  expect(action).toHaveBeenCalledTimes(1);
  expect(saveNow).not.toHaveBeenCalled();
  expect(guard().asking).toBe(false);
});

test("Save carries on once saved", async () => {
  const { guard, action } = setup(saving);
  edit();
  act(() => guard().askFirst(action));
  await act(() => guard().save());
  expect(action).toHaveBeenCalledTimes(1);
  expect(guard().asking).toBe(false);
});

test("Save does not carry on if the save did not happen", async () => {
  const { guard, action } = setup();
  edit();
  act(() => guard().askFirst(action));
  await act(() => guard().save());
  expect(action).not.toHaveBeenCalled();
  expect(guard().asking).toBe(false);
});

test("closing the window with unsaved changes asks, then closes it", () => {
  const { guard } = setup();
  const [shouldAsk, ask] = vi.mocked(interceptWindowClose).mock.calls[0];
  expect(shouldAsk()).toBe(false);
  edit();
  expect(shouldAsk()).toBe(true);

  act(() => ask());
  expect(guard().asking).toBe(true);
  act(() => guard().discard());
  expect(closeWindow).toHaveBeenCalledTimes(1);
});

test("a browser tab warns on the way out only while there are unsaved changes", () => {
  setup();
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(leave()).toBe(false);
  edit();
  expect(leave()).toBe(true);
});

function slowSave() {
  let finish = () => {};
  const saveNow = vi.fn(() => {
    const { diagram } = getAppState();
    return new Promise<boolean>((resolve) => {
      finish = () => {
        markSaved(diagram, { name: "kept.json" });
        resolve(true);
      };
    });
  });
  return { saveNow, finish: () => act(async () => finish()) };
}

test("cancelling while it is saving stops what would have followed", async () => {
  const { saveNow, finish } = slowSave();
  const { guard, action } = setup(saveNow);
  edit();
  act(() => guard().askFirst(action));
  act(() => void guard().save());
  act(() => guard().cancel());
  await finish();
  expect(action).not.toHaveBeenCalled();
  expect(guard().asking).toBe(false);
});

test("edits made while it was saving are not lost: it asks again rather than carrying on", async () => {
  const { saveNow, finish } = slowSave();
  const { guard, action } = setup(saveNow);
  edit();
  act(() => guard().askFirst(action));
  act(() => void guard().save());
  act(() => addObject(shape("later", "Later", "text"), "Add text"));
  await finish();
  expect(action).not.toHaveBeenCalled();
  expect(guard().asking).toBe(true);
});
