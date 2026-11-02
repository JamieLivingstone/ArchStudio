import { expect, test, vi } from "vitest";
import { providers, testConnection } from "..";

const [anthropic, openai] = providers;
const key = "sk-test-abcdefghijklmnopqrstuvwxyz";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const said = (message: string, status: number) => json({ error: { message } }, status);
const answer = json({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-haiku-5-5",
  content: [{ type: "text", text: "Hello" }],
  stop_reason: "max_tokens",
  usage: { input_tokens: 8, output_tokens: 1 },
});

function sent(fetch: ReturnType<typeof vi.fn>) {
  const [input, init] = fetch.mock.calls[0] as [RequestInfo, RequestInit];
  const request = new Request(input, init);
  return { url: request.url, headers: request.headers, body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

test("a key is tried with one short request to the provider's cheapest model, the way real requests go", async () => {
  const fetch = vi.fn(async () => answer.clone());
  await testConnection(anthropic, { fetch, apiKey: key });
  const { url, headers, body } = sent(fetch);
  expect(url).toBe("https://api.anthropic.com/v1/messages");
  expect(body).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 16 });
  expect(headers.get("x-api-key")).toBe(key);
  expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
});

test("with no key in hand the `fetch` is left to add it", async () => {
  const fetch = vi.fn(async () => answer.clone());
  await testConnection(anthropic, { fetch });
  const { headers } = sent(fetch);
  expect(headers.get("x-api-key")).toBe("added-by-fetch");
  expect(headers.get("anthropic-dangerous-direct-browser-access")).toBeNull();
});

test.each([
  [
    401,
    "Incorrect API key provided: sk-test-****wxyz",
    "OpenAI did not accept this key. Check it was copied in full and has not been revoked.",
  ],
  [403, "No access", "OpenAI accepted the key, but it is not allowed to use gpt-6-luna. It said: “No access”"],
  [404, "No such model", "OpenAI has no model called gpt-6-luna for this key. It said: “No such model”"],
  [
    429,
    "You exceeded your current quota.",
    "OpenAI recognised the key but refused the request: it is rate limited or out of credit. It said: “You exceeded your current quota.”",
  ],
  [503, "Overloaded", "OpenAI is having problems right now. Try again shortly."],
  [400, "Unsupported parameter", "OpenAI refused the request (400). It said: “Unsupported parameter”"],
])("a refusal with %i is explained in one sentence", async (status, message, explained) => {
  const fetch = vi.fn(async () => said(message, status));
  await expect(testConnection(openai, { fetch, apiKey: key })).rejects.toThrow(new Error(explained));
});

test("what a provider said is cut short", async () => {
  const fetch = vi.fn(async () => said("x".repeat(500), 400));
  const error = await testConnection(openai, { fetch, apiKey: key }).catch((caught: Error) => caught);
  expect((error as Error).message.match(/x/g)).toHaveLength(200);
});

test("a refusal a browser cannot read looks like no connection, so the key is mentioned first", async () => {
  const offline = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  await expect(testConnection(anthropic, { fetch: offline, apiKey: key })).rejects.toThrow(
    /^Anthropic gave no answer this app could read\. It most likely did not accept the key.*check your connection\.$/,
  );

  const slow = vi.fn(async () => {
    throw new DOMException("The operation timed out.", "TimeoutError");
  });
  await expect(testConnection(anthropic, { fetch: slow, apiKey: key })).rejects.toThrow(
    "Anthropic did not answer in time. Try again.",
  );
});

test("what the desktop app's `fetch` says went wrong is passed on as it is", async () => {
  const refused = vi.fn(async () => {
    throw new Error("No API key is saved for this provider.");
  });
  await expect(testConnection(openai, { fetch: refused })).rejects.toThrow("No API key is saved for this provider.");
});

test("each provider builds its own model for the Vercel AI SDK", () => {
  const access = { fetch: vi.fn(), apiKey: key };
  expect(anthropic.languageModel("claude-opus-5-5", access)).toMatchObject({ modelId: "claude-opus-5-5" });
  expect(openai.languageModel("gpt-6-astra", access)).toMatchObject({ modelId: "gpt-6-astra" });
});

test("a refusal whose body is not what a provider sends is still explained", async () => {
  const fetch = vi.fn(async () => json(null, 400));
  await expect(testConnection(openai, { fetch, apiKey: key })).rejects.toThrow(
    new Error("OpenAI refused the request (400)."),
  );
});

test("a test that is called off stops waiting for the provider", async () => {
  const calledOff = new AbortController();
  const fetch = vi.fn(
    (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
  );
  const tried = testConnection(openai, { fetch, apiKey: key }, calledOff.signal);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  calledOff.abort();
  await expect(tried).rejects.toThrow();
});
