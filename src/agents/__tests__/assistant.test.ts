import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { emptyDiagram } from "../../diagram/schema";
import { component } from "../../test/diagram";
import { type AssistantProgress, runAssistant } from "../assistant";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

type Answer = { text?: string; propose?: unknown };

function model(...answers: Answer[]) {
  return new MockLanguageModelV4({
    doStream: answers.map(({ text, propose }, index) => ({
      stream: simulateReadableStream({
        chunks: [
          ...(text
            ? [
                { type: "text-start" as const, id: "t" },
                ...text.split(" ").map((word, at) => ({
                  type: "text-delta" as const,
                  id: "t",
                  delta: at === 0 ? word : ` ${word}`,
                })),
                { type: "text-end" as const, id: "t" },
              ]
            : []),
          ...(propose
            ? [
                { type: "tool-input-start" as const, id: `call-${index}`, toolName: "propose" },
                ...(JSON.stringify({ operations: propose }).match(/.{1,40}/g) ?? []).map((delta) => ({
                  type: "tool-input-delta" as const,
                  id: `call-${index}`,
                  delta,
                })),
                { type: "tool-input-end" as const, id: `call-${index}` },
                {
                  type: "tool-call" as const,
                  toolCallId: `call-${index}`,
                  toolName: "propose",
                  input: JSON.stringify({ operations: propose }),
                },
              ]
            : []),
          {
            type: "finish" as const,
            finishReason: { unified: propose ? ("tool-calls" as const) : ("stop" as const), raw: undefined },
            usage,
          },
        ],
      }),
    })),
  });
}

const addCache = [
  { type: "object.add", object: { type: "component", id: "cache", kind: "cache", name: "Cache" } },
  { type: "connection.add", connection: { id: "api-cache", from: "api", to: "cache" } },
];
const api = component("api", "API");
const diagram = { ...emptyDiagram(), objects: [api] };

function run(llm: MockLanguageModelV4, extra: Partial<Parameters<typeof runAssistant>[0]> = {}) {
  const streamed: string[] = [];
  const progress: AssistantProgress[] = [];
  const result = runAssistant({
    model: llm,
    history: [],
    diagram,
    request: "Add a cache",
    selected: [],
    onText: (text) => streamed.push(text),
    onProgress: (each) => progress.push(each),
    ...extra,
  });
  return { result, streamed, progress };
}

const sent = (llm: MockLanguageModelV4, call = 0) => JSON.stringify(llm.doStreamCalls[call].prompt);

test("streams what the model says, then returns its proposal as diagram operations", async () => {
  const llm = model({ text: "Adding a cache.", propose: addCache });
  const { result, streamed } = run(llm);
  const { text, operations, problems } = await result;
  expect(streamed).toEqual(["Adding", "Adding a", "Adding a cache."]);
  expect(text).toBe("Adding a cache.");
  expect(operations).toEqual([
    {
      type: "object.add",
      object: { type: "component", id: "cache", kind: "cache", name: "Cache", options: {}, position: { x: 0, y: 0 } },
    },
    {
      type: "connection.add",
      connection: { id: "api-cache", from: "api", to: "cache", label: "", direction: "forward", line: "solid" },
    },
  ]);
  expect(problems).toBeUndefined();
  expect(llm.doStreamCalls).toHaveLength(1);
});

test("while it drafts, says how many edits it has written and the names it has given", async () => {
  const { result, progress } = run(model({ propose: addCache }));
  await result;
  expect(progress[0]).toEqual({ stage: "drafting", edits: 0, names: [] });
  expect(progress).toContainEqual({ stage: "drafting", edits: 1, names: ["Cache"] });
  expect(progress[progress.length - 1]).toEqual({ stage: "drafting", edits: 2, names: ["Cache"] });
});

test("says when it corrects a draft", async () => {
  const wrong = [{ type: "object.remove", id: "nowhere" }];
  const { result, progress } = run(model({ propose: wrong }, { propose: addCache }));
  await result;
  expect(progress.filter(({ stage }) => stage !== "drafting")).toEqual([{ stage: "correcting" }]);
});

test("sends the diagram, the selection, the request, and every kind with its options", async () => {
  const llm = model({ text: "Which cache?" });
  await run(llm, { selected: ["api"] }).result;
  const prompt = sent(llm);
  expect(prompt).toContain('[api] \\"API\\" (Load Balancer)');
  expect(prompt).toContain("The user has selected: [api]");
  expect(prompt).toContain("Request: Add a cache");
  expect(prompt).toContain("- cache (Cache): Keeps copies of frequently read data in memory");
  expect(prompt).toContain("eviction: one of: LRU");
  expect(prompt).toContain("- trustZone: A network or trust boundary");
});

test("a question back is a reply with nothing proposed", async () => {
  const { result } = run(model({ text: "In front of which database?" }));
  expect(await result).toEqual({ text: "In front of which database?", operations: undefined, problems: undefined });
});

test("the part that is the same in every request is marked for caching", async () => {
  const llm = model({ text: "Which cache?" });
  await run(llm).result;
  const [system] = llm.doStreamCalls[0].prompt;
  expect(system).toMatchObject({
    role: "system",
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  });
});

test("the conversation so far goes before the latest request", async () => {
  const llm = model({ propose: addCache });
  await run(llm, {
    history: [
      { role: "user", text: "Add a cache" },
      { role: "assistant", text: "In front of what?" },
    ],
    request: "The API",
  }).result;
  const roles = llm.doStreamCalls[0].prompt.map(({ role }) => role);
  expect(roles).toEqual(["system", "user", "assistant", "user"]);
  expect(sent(llm)).toContain("In front of what?");
});

test("an invalid proposal goes back to the model, which corrects it", async () => {
  const wrong = [{ type: "connection.add", connection: { id: "c", from: "api", to: "nowhere" } }];
  const llm = model({ propose: wrong }, { propose: addCache });
  const { operations, problems } = await run(llm).result;
  expect(operations).toHaveLength(2);
  expect(problems).toBeUndefined();
  expect(llm.doStreamCalls).toHaveLength(2);
  expect(sent(llm, 1)).toContain("Nothing was proposed. Fix these and propose again");
});

test("a model that never gets it right stops after four attempts and says what was wrong", async () => {
  const wrong = { propose: [{ type: "object.remove", id: "nowhere" }] };
  const llm = model(wrong, wrong, wrong, wrong, wrong);
  const { operations, problems } = await run(llm).result;
  expect(llm.doStreamCalls).toHaveLength(4);
  expect(operations).toBeUndefined();
  expect(problems).toMatch(/^Operation 0: /);
});

test("calling it off rejects", async () => {
  const stop = new AbortController();
  stop.abort();
  await expect(run(model({ text: "Adding." }), { signal: stop.signal }).result).rejects.toThrow();
});

test("a failed request rejects with the provider's error", async () => {
  const llm = new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("Rate limited");
    },
  });
  await expect(run(llm).result).rejects.toThrow("Rate limited");
});
