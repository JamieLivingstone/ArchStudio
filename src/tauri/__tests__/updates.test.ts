import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { afterEach, expect, test, vi } from "vitest";
import { findUpdate } from "../updates";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
});

test("a browser never looks for an update", async () => {
  vi.mocked(isTauri).mockReturnValue(false);
  expect(await findUpdate()).toBeNull();
  expect(check).not.toHaveBeenCalled();
});

test("finds nothing when the app is up to date", async () => {
  expect(await findUpdate()).toBeNull();
});

test("installing downloads the update and only then restarts", async () => {
  const downloadAndInstall = vi.fn(async () => {});
  vi.mocked(check).mockResolvedValueOnce({ version: "0.2.0", downloadAndInstall } as never);
  const update = await findUpdate();
  expect(update?.version).toBe("0.2.0");
  await update?.install();
  expect(vi.mocked(downloadAndInstall).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(relaunch).mock.invocationCallOrder[0],
  );
});

test("a failed download does not restart the app", async () => {
  const downloadAndInstall = vi.fn(async () => {
    throw new Error("The download was interrupted.");
  });
  vi.mocked(check).mockResolvedValueOnce({ version: "0.2.0", downloadAndInstall } as never);
  const update = await findUpdate();
  await expect(update?.install()).rejects.toThrow("The download was interrupted.");
  expect(relaunch).not.toHaveBeenCalled();
});
