import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { setWindowTheme } from "../../../tauri/window";
import { useTheme } from "../useTheme";

vi.mock("../../../tauri/window", () => ({
  setWindowTheme: vi.fn(),
  interceptWindowClose: () => () => {},
  closeWindow: vi.fn(),
}));

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test("starts on the system theme", () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current[0]).toBe("system");
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(setWindowTheme).toHaveBeenLastCalledWith(null);
});

test("forces a theme on the page and the native window", () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current[1]("dark"));
  expect(result.current[0]).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(setWindowTheme).toHaveBeenLastCalledWith("dark");
});

test("returns to following the system", () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current[1]("light"));
  act(() => result.current[1]("system"));
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(setWindowTheme).toHaveBeenLastCalledWith(null);
});

test("a chosen theme is there the next time the app opens", () => {
  const first = renderHook(() => useTheme());
  act(() => first.result.current[1]("dark"));
  first.unmount();
  delete document.documentElement.dataset.theme;

  const { result } = renderHook(() => useTheme());
  expect(result.current[0]).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(setWindowTheme).toHaveBeenLastCalledWith("dark");
});

test("going back to the system theme forgets the choice", () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current[1]("dark"));
  act(() => result.current[1]("system"));
  expect(localStorage.length).toBe(0);
});

test("a stored value that is not a theme is ignored", () => {
  localStorage.setItem("archstudio.theme", "neon");
  expect(renderHook(() => useTheme()).result.current[0]).toBe("system");
});

test("blocked storage still changes the theme", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  const { result } = renderHook(() => useTheme());
  expect(result.current[0]).toBe("system");
  act(() => result.current[1]("dark"));
  expect(result.current[0]).toBe("dark");
});
