import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { findUpdate } from "../../../tauri/updates";
import { useUpdate } from "../useUpdate";

vi.mock("../../../tauri/updates", () => ({ findUpdate: vi.fn(async () => null) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(findUpdate).mockReset();
  vi.mocked(findUpdate).mockResolvedValue(null);
});

test("offers nothing when there is no update", async () => {
  const { result } = renderHook(() => useUpdate());
  await act(async () => {});
  expect(result.current.version).toBeUndefined();
});

test("offers an update it finds, until it is put off", async () => {
  vi.mocked(findUpdate).mockResolvedValue({ version: "0.2.0", install: vi.fn() });
  const { result } = renderHook(() => useUpdate());
  await waitFor(() => expect(result.current.version).toBe("0.2.0"));
  act(() => result.current.dismiss());
  expect(result.current.version).toBeUndefined();
});

test("a failed check does not interrupt anyone", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(findUpdate).mockRejectedValue(new Error("Offline"));
  const { result } = renderHook(() => useUpdate());
  await waitFor(() => expect(logged).toHaveBeenCalled());
  expect(result.current.version).toBeUndefined();
  expect(result.current.error).toBe("");
});

test("a failed install says why and can be tried again", async () => {
  const install = vi.fn(async () => {
    throw new Error("The download was interrupted.");
  });
  vi.mocked(findUpdate).mockResolvedValue({ version: "0.2.0", install });
  const { result } = renderHook(() => useUpdate());
  await waitFor(() => expect(result.current.version).toBe("0.2.0"));
  await act(() => result.current.install());
  expect(result.current.error).toBe("Could not install the update. The download was interrupted.");
  expect(result.current.installing).toBe(false);
});
