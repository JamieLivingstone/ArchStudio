import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { afterEach, expect, test, vi } from "vitest";
import { interceptWindowClose, openLink, setWindowTheme } from "../window";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

function mockWindow(setTheme: () => Promise<void>) {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(getCurrentWindow).mockReturnValue({ setTheme } as unknown as ReturnType<typeof getCurrentWindow>);
}

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

test("setting the theme does nothing outside the Tauri runtime", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  setWindowTheme("dark");
  expect(getCurrentWindow).not.toHaveBeenCalled();
});

test("passes the theme to the native window", () => {
  const setTheme = vi.fn().mockResolvedValue(undefined);
  mockWindow(setTheme);
  setWindowTheme("dark");
  setWindowTheme(null);
  expect(setTheme.mock.calls).toEqual([["dark"], [null]]);
});

test("reports a failure instead of swallowing it", async () => {
  const error = new Error("denied");
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  mockWindow(vi.fn().mockRejectedValue(error));
  setWindowTheme("light");
  await vi.waitFor(() => expect(logged).toHaveBeenCalledWith(expect.any(String), error));
});

type CloseHandler = (event: { preventDefault: () => void }) => void;

test("closing is not intercepted outside the Tauri runtime", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  interceptWindowClose(() => true, vi.fn())();
  expect(getCurrentWindow).not.toHaveBeenCalled();
});

test("holds the window open and asks only when it should", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  let requestClose: CloseHandler = () => {};
  const stopListening = vi.fn();
  vi.mocked(getCurrentWindow).mockReturnValue({
    onCloseRequested: (handler: CloseHandler) => {
      requestClose = handler;
      return Promise.resolve(stopListening);
    },
  } as unknown as ReturnType<typeof getCurrentWindow>);

  let unsaved = false;
  const ask = vi.fn();
  const stop = interceptWindowClose(() => unsaved, ask);

  const event = { preventDefault: vi.fn() };
  requestClose(event);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(ask).not.toHaveBeenCalled();

  unsaved = true;
  requestClose(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(ask).toHaveBeenCalledTimes(1);

  stop();
  await vi.waitFor(() => expect(stopListening).toHaveBeenCalled());
});

test("a link opens in the user's browser, not in the app's window", () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(openUrl).mockResolvedValue(undefined);
  openLink("https://example.com/keys");
  expect(openUrl).toHaveBeenCalledWith("https://example.com/keys");
});

test("outside the desktop app a link opens in a new tab that cannot reach back", () => {
  vi.mocked(isTauri).mockReturnValue(false);
  const opened = vi.spyOn(window, "open").mockImplementation(() => null);
  openLink("https://example.com/keys");
  expect(opened).toHaveBeenCalledWith("https://example.com/keys", "_blank", "noopener,noreferrer");
  expect(openUrl).not.toHaveBeenCalled();
});
