import { type Channel, invoke } from "@tauri-apps/api/core";
import { afterEach, expect, test, vi } from "vitest";
import * as native from "../providers";

type ResponseEvent =
  | { type: "head"; status: number; headers: [string, string][] }
  | { type: "chunk"; bytes: number[] }
  | { type: "done" };

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(),
  Channel: class {
    onmessage: (part: unknown) => void = () => {};
  },
}));

afterEach(() => vi.resetAllMocks());

const bytes = (text: string) => [...new TextEncoder().encode(text)];

function answering(parts: ResponseEvent[], failure?: string) {
  vi.mocked(invoke).mockImplementation(async (_command, args) => {
    const { onPart } = args as { onPart: Channel<ResponseEvent> };
    for (const part of parts) onPart.onmessage(part);
    if (failure) throw failure;
    onPart.onmessage({ type: "done" });
  });
}

test("a key is held to be tried, then saved or let go, and can be removed", async () => {
  vi.mocked(invoke).mockResolvedValue(["anthropic"]);
  await native.holdApiKey("anthropic", "sk-ant-secret");
  await native.saveApiKey("anthropic");
  await native.discardApiKey("anthropic");
  await native.deleteApiKey("openai");
  expect(await native.storedApiKeys()).toEqual(["anthropic"]);
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ["hold_api_key", { provider: "anthropic", key: "sk-ant-secret" }],
    ["save_api_key", { provider: "anthropic" }],
    ["discard_api_key", { provider: "anthropic" }],
    ["delete_api_key", { provider: "openai" }],
    ["stored_api_keys"],
  ]);
});

test("there is no way to read a key back", () => {
  expect(Object.keys(native).sort()).toEqual([
    "deleteApiKey",
    "discardApiKey",
    "holdApiKey",
    "isDesktop",
    "nativeFetch",
    "saveApiKey",
    "storedApiKeys",
  ]);
});

test("a request is handed to the native layer whole, and its answer comes back as a response", async () => {
  answering([
    { type: "head", status: 200, headers: [["content-type", "application/json"]] },
    { type: "chunk", bytes: bytes('{"ok":') },
    { type: "chunk", bytes: bytes("true}") },
  ]);
  const response = await native.nativeFetch("anthropic")("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "added-by-fetch" },
    body: '{"model":"claude"}',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(await response.json()).toEqual({ ok: true });

  const [command, args] = vi.mocked(invoke).mock.calls[0] as [string, { request: Record<string, unknown> }];
  expect(command).toBe("provider_request");
  expect(args.request).toMatchObject({
    provider: "anthropic",
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    body: '{"model":"claude"}',
  });
  expect(args.request.headers).toContainEqual(["content-type", "application/json"]);
});

test("a refusal comes back as a response to be read, not as a failure", async () => {
  answering([
    { type: "head", status: 401, headers: [] },
    { type: "chunk", bytes: bytes('{"error":{"message":"bad key"}}') },
  ]);
  const response = await native.nativeFetch("openai")("https://api.openai.com/v1/responses", {
    method: "POST",
    body: "{}",
  });
  expect(response.ok).toBe(false);
  expect(await response.json()).toEqual({ error: { message: "bad key" } });
});

test("a request that could not be made rejects with why", async () => {
  answering([], "Could not reach api.openai.com.");
  await expect(native.nativeFetch("openai")("https://api.openai.com/v1/responses")).rejects.toThrow(
    "Could not reach api.openai.com.",
  );
});

test("an answer that breaks off part way fails while it is being read", async () => {
  answering([{ type: "head", status: 200, headers: [] }], "api.openai.com did not answer in time.");
  const response = await native.nativeFetch("openai")("https://api.openai.com/v1/responses");
  await expect(response.text()).rejects.toThrow("did not answer in time");
});

test("a request with no body sends none", async () => {
  answering([{ type: "head", status: 204, headers: [] }]);
  const response = await native.nativeFetch("openai")("https://api.openai.com/v1/models");
  expect(response.status).toBe(204);
  const [, args] = vi.mocked(invoke).mock.calls[0] as [string, { request: Record<string, unknown> }];
  expect(args.request).toMatchObject({ method: "GET", body: undefined });
});

test("a request cancelled before it starts is never sent", async () => {
  const request = native.nativeFetch("openai")("https://api.openai.com/v1/responses", { signal: AbortSignal.abort() });
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(invoke).not.toHaveBeenCalled();
});

test("cancelling while waiting stops the wait, and what arrives afterwards is ignored", async () => {
  let onPart!: Channel<ResponseEvent>;
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "provider_request") onPart = (args as { onPart: Channel<ResponseEvent> }).onPart;
    return new Promise(() => {});
  });
  const cancel = new AbortController();
  const request = native.nativeFetch("openai")("https://api.openai.com/v1/responses", { signal: cancel.signal });
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  cancel.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(() => onPart.onmessage({ type: "chunk", bytes: [1] })).not.toThrow();
  const [, sent] = vi.mocked(invoke).mock.calls[0] as [string, { request: { id: string } }];
  expect(invoke).toHaveBeenLastCalledWith("cancel_provider_request", { id: sent.request.id });
});

test("a request cancelled while its body is being read is not sent", async () => {
  const cancel = new AbortController();
  const request = native.nativeFetch("openai")("https://api.openai.com/v1/responses", {
    method: "POST",
    body: "{}",
    signal: cancel.signal,
  });
  cancel.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(invoke).not.toHaveBeenCalled();
});

test("giving up on an answer part way cancels the request, and what arrives afterwards is ignored", async () => {
  let onPart!: Channel<ResponseEvent>;
  vi.mocked(invoke).mockImplementation((command, args) => {
    if (command === "provider_request") onPart = (args as { onPart: Channel<ResponseEvent> }).onPart;
    return new Promise(() => {});
  });
  const waiting = native.nativeFetch("openai")("https://api.openai.com/v1/responses");
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  onPart.onmessage({ type: "head", status: 200, headers: [] });
  const response = await waiting;
  await response.body?.cancel();
  const [, sent] = vi.mocked(invoke).mock.calls[0] as [string, { request: { id: string } }];
  expect(invoke).toHaveBeenLastCalledWith("cancel_provider_request", { id: sent.request.id });
  expect(() => onPart.onmessage({ type: "chunk", bytes: [1] })).not.toThrow();
});

test("parts that arrive after the command has returned are still part of the answer", async () => {
  let onPart!: Channel<ResponseEvent>;
  vi.mocked(invoke).mockImplementation(async (_command, args) => {
    onPart = (args as { onPart: Channel<ResponseEvent> }).onPart;
  });
  const waiting = native.nativeFetch("openai")("https://api.openai.com/v1/responses");
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  await Promise.resolve();
  onPart.onmessage({ type: "head", status: 200, headers: [] });
  onPart.onmessage({ type: "chunk", bytes: bytes('{"id":"resp_1"}') });
  onPart.onmessage({ type: "done" });
  expect(await (await waiting).json()).toEqual({ id: "resp_1" });
});
