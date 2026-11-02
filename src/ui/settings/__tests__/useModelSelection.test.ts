import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { testConnection } from "../../../providers";
import * as native from "../../../tauri/providers";
import { useModelSelection } from "../useModelSelection";

vi.mock("../../../providers", async (original) => ({
  ...(await original<typeof import("../../../providers")>()),
  testConnection: vi.fn(async () => {}),
}));
vi.mock("../../../tauri/providers", () => ({
  isDesktop: vi.fn(() => true),
  storedApiKeys: vi.fn(async () => []),
  holdApiKey: vi.fn(async () => {}),
  saveApiKey: vi.fn(async () => {}),
  discardApiKey: vi.fn(async () => {}),
  deleteApiKey: vi.fn(async () => {}),
  nativeFetch: vi.fn((provider: string) => `native fetch for ${provider}`),
}));

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(native.isDesktop).mockReturnValue(true);
});

const key = "sk-ant-api03-abcdefghijklmnop";
const calls = () =>
  Object.entries(native).flatMap(([name, mock]) =>
    name === "isDesktop" || name === "nativeFetch" ? [] : vi.mocked(mock).mock.calls.map((args) => [name, ...args]),
  );

test("has no model until a provider is connected", () => {
  const { result } = renderHook(() => useModelSelection());
  expect(result.current.model).toBeUndefined();
  expect(result.current.connectedProviders).toEqual([]);
  expect(result.current.access("anthropic")).toBeUndefined();
});

test("in the desktop app, providers whose keys are already saved are connected from the start", async () => {
  vi.mocked(native.storedApiKeys).mockResolvedValueOnce(["openai"]);
  const { result } = renderHook(() => useModelSelection());
  await waitFor(() => expect(result.current.model?.id).toBe("gpt-6-astra"));
  expect(result.current.connected).toEqual(["openai"]);
});

test("in the desktop app a key is held, tried through the native layer, and only then saved", async () => {
  const { result } = renderHook(() => useModelSelection());
  await act(() => result.current.connect("anthropic", ` ${key} `));
  expect(calls()).toEqual([["storedApiKeys"], ["holdApiKey", "anthropic", key], ["saveApiKey", "anthropic"]]);
  expect(testConnection).toHaveBeenCalledWith(
    expect.objectContaining({ id: "anthropic" }),
    { fetch: "native fetch for anthropic" },
    undefined,
  );
  expect(result.current.connected).toEqual(["anthropic"]);
  expect(result.current.model?.id).toBe("claude-opus-5-5");
  expect(result.current.access("anthropic")).toEqual({ fetch: "native fetch for anthropic" });
});

test("a key that fails its test is let go, not saved, and says why", async () => {
  vi.mocked(testConnection).mockRejectedValueOnce(new Error("Anthropic did not accept this key."));
  const { result } = renderHook(() => useModelSelection());
  await expect(act(() => result.current.connect("anthropic", key))).rejects.toThrow(
    "Anthropic did not accept this key.",
  );
  expect(native.discardApiKey).toHaveBeenCalledWith("anthropic");
  expect(native.saveApiKey).not.toHaveBeenCalled();
  expect(result.current.connectedProviders).toEqual([]);
});

test("in a browser a key is tried directly and kept in session storage", async () => {
  vi.mocked(native.isDesktop).mockReturnValue(false);
  const { result } = renderHook(() => useModelSelection());
  await act(() => result.current.connect("openai", key));
  expect(calls()).toEqual([]);
  expect(testConnection).toHaveBeenCalledWith(
    expect.objectContaining({ id: "openai" }),
    expect.objectContaining({ apiKey: key, fetch: expect.any(Function) }),
    undefined,
  );
  expect(result.current.connected).toEqual(["openai"]);
  expect(result.current.access("openai")).toMatchObject({ apiKey: key });

  await act(() => result.current.disconnect("openai"));
  expect(result.current.access("openai")).toBeUndefined();
  expect(calls()).toEqual([]);
});

test("disconnecting removes the saved key, and the model falls back to another provider's", async () => {
  const { result } = renderHook(() => useModelSelection());
  await act(() => result.current.connect("anthropic", key));
  await act(() => result.current.connect("openai", key));
  act(() => result.current.setModel("openai", "gpt-6-astra"));
  expect(result.current.model?.id).toBe("gpt-6-astra");

  await act(() => result.current.disconnect("openai"));
  expect(native.deleteApiKey).toHaveBeenCalledWith("openai");
  expect(result.current.model?.id).toBe("claude-opus-5-5");

  await act(() => result.current.disconnect("anthropic"));
  expect(result.current.model).toBeUndefined();
});

test("a key whose test was called off is let go, not saved", async () => {
  const calledOff = new AbortController();
  vi.mocked(testConnection).mockImplementationOnce(async () => calledOff.abort());
  const { result } = renderHook(() => useModelSelection());
  await expect(act(() => result.current.connect("anthropic", key, calledOff.signal))).rejects.toThrow();
  expect(native.discardApiKey).toHaveBeenCalledWith("anthropic");
  expect(native.saveApiKey).not.toHaveBeenCalled();
  expect(result.current.connected).toEqual([]);
});

test("a second key for a provider waits until the first has been dealt with", async () => {
  let finish = () => {};
  vi.mocked(testConnection).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  const { result } = renderHook(() => useModelSelection());
  let both: Promise<unknown> = Promise.resolve();
  act(() => {
    both = Promise.all([result.current.connect("anthropic", key), result.current.connect("anthropic", `${key}2`)]);
  });
  await waitFor(() => expect(testConnection).toHaveBeenCalledTimes(1));
  expect(calls()).toEqual([["storedApiKeys"], ["holdApiKey", "anthropic", key]]);
  await act(async () => {
    finish();
    await both;
  });
  expect(native.holdApiKey).toHaveBeenLastCalledWith("anthropic", `${key}2`);
  expect(native.saveApiKey).toHaveBeenCalledTimes(2);
  const [firstSaved] = vi.mocked(native.saveApiKey).mock.invocationCallOrder;
  expect(vi.mocked(native.holdApiKey).mock.invocationCallOrder[1]).toBeGreaterThan(firstSaved);
});

test("in a browser a key outlasts a reload, and removing it forgets it", async () => {
  vi.mocked(native.isDesktop).mockReturnValue(false);
  const first = renderHook(() => useModelSelection());
  await act(() => first.result.current.connect("openai", key));
  expect({ ...sessionStorage }).toEqual({ "archstudio.apiKey.openai": key });
  expect({ ...localStorage }).toEqual({});
  expect(document.cookie).toBe("");
  first.unmount();

  const { result } = renderHook(() => useModelSelection());
  await waitFor(() => expect(result.current.connected).toEqual(["openai"]));
  expect(result.current.access("openai")).toMatchObject({ apiKey: key });
  expect(testConnection).toHaveBeenCalledTimes(1);

  await act(() => result.current.disconnect("openai"));
  expect(sessionStorage.length).toBe(0);
  expect(result.current.access("openai")).toBeUndefined();
});

test("a key that fails its test in a browser is not kept", async () => {
  vi.mocked(native.isDesktop).mockReturnValue(false);
  vi.mocked(testConnection).mockRejectedValueOnce(new Error("OpenAI did not accept this key."));
  const { result } = renderHook(() => useModelSelection());
  await expect(act(() => result.current.connect("openai", key))).rejects.toThrow();
  expect(sessionStorage.length).toBe(0);
});

test("the desktop app keeps nothing in the webview's storage", async () => {
  sessionStorage.setItem("archstudio.apiKey.openai", key);
  const { result } = renderHook(() => useModelSelection());
  await act(() => result.current.connect("anthropic", key));
  expect(result.current.connected).toEqual(["anthropic"]);
  expect(sessionStorage.length).toBe(1);
});
