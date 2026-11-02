import { isStepCount, type LanguageModel, type ModelMessage, type SystemModelMessage, streamText, tool } from "ai";
import { z } from "zod";
import { describeDiagram, describeKinds } from "../diagram/describe";
import type { DiagramOperation } from "../diagram/operations";
import type { Diagram } from "../diagram/schema";
import { validateOperations } from "../diagram/validate";
import { editOperationSchema, toDiagramOperations } from "./editOperations";

const MAX_STEPS = 4;

const instructions = `You are the assistant in ArchStudio, working with the user on a software architecture diagram. You answer questions about it, review it and change it. You change it only by calling propose; the user then reviews the proposal and accepts or rejects each part.

What to do:
- A question: answer it from the diagram. If the diagram does not show something, say so rather than guessing. A missing option means not specified. A general architecture question gets a general answer, tied back to the diagram where that helps. Do not call propose.
- A request to review: find the risks and gaps that matter most, most serious first. For each, say what is wrong, where, why it matters and what to do about it. Keep to what the diagram shows, and say what it leaves unclear. Do not call propose unless the user asks for the fixes.
- A clear request for a change: say in one sentence what you are changing, then call propose with every operation it needs.
- A change that leaves open a choice that shapes the design, such as a queue or an event stream, or where to split a service, and nothing in the diagram or conversation settles it: ask instead, with at most three short questions, each with the options and what they trade off.

If something is selected, the request is probably about it.

How to write:
- Keep it short. Use Markdown: bullet lists, nested where that helps, and bold for names. No tables, links or images.
- Call things by their names, not their ids.

Rules for changes:
- Change only what the request needs.
- Refer to existing things by the ids in square brackets. Give new ones short, readable, unused ids, such as "orders-cache".
- Use the kinds below. The technology goes in the name or tags, such as a database named "Orders database" tagged "PostgreSQL". If no kind fits, use a rectangle.
- Set only the options the request asks for or clearly implies, with the values listed below. A missing option means not specified.
- Use boundaries where they add meaning: what runs as one service, what a team owns, a business domain, a trust zone or a region. Put something new inside the boundary it belongs to. Each thing sits in at most one boundary; use tags for any other grouping.
- A connection points from the caller to what it calls. To put something between two components, remove the connection between them and connect each to the new one.
- Leave out positions and sizes; the app arranges the result.
- If propose reports problems, fix them and propose the whole change again.

The latest message holds the diagram as it is now, after whatever the user accepted or rejected.

${describeKinds()}`;

// The tools, the instructions and the catalogue are the same in every request, so they are cached. Anthropic is
// told where the cached part ends; OpenAI caches a repeated start by itself.
const system: SystemModelMessage = {
  role: "system",
  content: instructions,
  providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
};

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export type AssistantProgress = { stage: "drafting"; edits: number; names: string[] } | { stage: "correcting" };

interface AssistantRequest {
  model: LanguageModel;
  history: Turn[];
  diagram: Diagram;
  request: string;
  selected: string[];
  signal?: AbortSignal;
  onText: (text: string) => void;
  onProgress: (progress: AssistantProgress) => void;
}

interface AssistantResult {
  text: string;
  operations?: DiagramOperation[];
  problems?: string;
}

function prompt({ diagram, request, selected }: AssistantRequest) {
  const described = describeDiagram(diagram);
  return [
    described ? `The diagram:\n${described}` : "The diagram is empty.",
    selected.length > 0 && `The user has selected: ${selected.map((id) => `[${id}]`).join(", ")}`,
    `Request: ${request}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function drafted(json: string): AssistantProgress {
  const edits = json.match(/"type"\s*:\s*"(object|connection)\.(add|update|remove)"/g)?.length ?? 0;
  const names = [...json.matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map(([, name]) => name);
  return { stage: "drafting", edits, names };
}

export async function runAssistant(asked: AssistantRequest): Promise<AssistantResult> {
  const { model, diagram, signal, onText, onProgress } = asked;
  let operations: DiagramOperation[] | undefined;
  let problems: string | undefined;

  const propose = tool({
    description: `Propose a change to the diagram for the user to review: every operation it needs, in order.
- object.add: a component, boundary, rectangle, sphere or text. Give a boundary's contents its id as their parent.
- object.update: change an existing object. options names only the options to change, and null clears one; parent moves it into a boundary, and null takes it out.
- object.remove: removes an object and its connections. A removed boundary's contents stay.
- connection.add, connection.update, connection.remove: the same for connections.`,
    inputSchema: z.object({ operations: z.array(editOperationSchema).min(1) }),
    execute: async (input) => {
      const proposed = toDiagramOperations(diagram, input.operations);
      const issues = validateOperations(diagram, proposed);
      if (issues.length > 0) {
        problems = issues.map(({ operation, message }) => `Operation ${operation}: ${message}`).join("\n");
        onProgress({ stage: "correcting" });
        throw new Error(`Nothing was proposed. Fix these and propose again:\n${problems}`);
      }
      operations = proposed;
      problems = undefined;
      return "Proposed. The user will review it.";
    },
  });

  const result = streamText({
    model,
    instructions: system,
    messages: [
      ...asked.history.map(({ role, text }): ModelMessage => ({ role, content: text })),
      { role: "user", content: prompt(asked) },
    ],
    tools: { propose },
    stopWhen: [() => operations !== undefined, isStepCount(MAX_STEPS)],
    abortSignal: signal,
  });

  let text = "";
  let draft = "";
  for await (const part of result.stream) {
    if (part.type === "text-delta") {
      text += part.text;
      onText(text);
    } else if (part.type === "tool-input-start" && part.toolName === "propose") {
      draft = "";
      onProgress({ stage: "drafting", edits: 0, names: [] });
    } else if (part.type === "tool-input-delta") {
      draft += part.delta;
      onProgress(drafted(draft));
    } else if (part.type === "error") {
      throw part.error;
    }
  }
  signal?.throwIfAborted();
  return { text, operations, problems };
}
