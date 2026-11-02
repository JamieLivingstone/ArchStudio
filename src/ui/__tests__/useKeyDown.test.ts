import { fireEvent, render, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { expect, test, vi } from "vitest";
import { hasCommandKey, isTyping, useKeyDown } from "../useKeyDown";

test("calls the handler for keys pressed anywhere, until unmounted", () => {
  const handler = vi.fn();
  const { unmount } = renderHook(() => useKeyDown(handler));
  fireEvent.keyDown(document, { key: "a" });
  fireEvent.keyDown(document.body, { key: "b" });
  expect(handler.mock.calls.map(([event]) => event.key)).toEqual(["a", "b"]);

  unmount();
  fireEvent.keyDown(document, { key: "c" });
  expect(handler).toHaveBeenCalledTimes(2);
});

test("always calls the latest handler", () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = renderHook(({ handler }) => useKeyDown(handler), {
    initialProps: { handler: first },
  });
  rerender({ handler: second });
  fireEvent.keyDown(document, { key: "a" });
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

test("knows when a key press is typing in a field", () => {
  const seen: boolean[] = [];
  renderHook(() => useKeyDown((event) => seen.push(isTyping(event))));
  const { container } = render(
    createElement("div", null, [
      createElement("input", { key: "input" }),
      createElement("textarea", { key: "textarea" }),
      createElement("select", { key: "select" }),
      createElement("button", { key: "button", type: "button" }),
    ]),
  );
  for (const tag of ["input", "textarea", "select", "button"]) {
    fireEvent.keyDown(container.querySelector(tag) as Element, { key: "a" });
  }
  expect(seen).toEqual([true, true, true, false]);
});

test("the command key is Cmd or Ctrl", () => {
  const key = (init: KeyboardEventInit) => hasCommandKey(new KeyboardEvent("keydown", init));
  expect(key({ metaKey: true })).toBe(true);
  expect(key({ ctrlKey: true })).toBe(true);
  expect(key({ shiftKey: true })).toBe(false);
});
