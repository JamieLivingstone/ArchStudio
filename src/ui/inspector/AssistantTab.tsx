import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eraser,
  Info,
  LoaderCircle,
  MousePointerClick,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type AssistantProgress, runAssistant, type Turn } from "../../agents/assistant";
import { explainError } from "../../providers";
import type { Proposal } from "../proposal";
import type { ModelSelection } from "../settings/useModelSelection";
import { dismissProposal, getAppState, propose } from "../state";
import { CopyButton } from "./CopyButton";
import { ProposalCard } from "./ProposalCard";
import { Reply } from "./Reply";
import { useSelectionScope } from "./useSelection";

type ChatMessage =
  | { id: string; kind: "user"; text: string; scope: string }
  | { id: string; kind: "reply"; text: string; status?: string }
  | { id: string; kind: "notice"; text: string }
  | { id: string; kind: "proposal"; proposal: Proposal };

interface AssistantTabProps {
  active: boolean;
  headerSlot: HTMLElement | null;
  onShowProperties: () => void;
  modelSelection: ModelSelection;
  onOpenSettings: () => void;
}

const MANAGE_MODELS = "manage-models";

function describeProgress(progress: AssistantProgress): string {
  if (progress.stage === "correcting") return "Fixing a problem in the draft…";
  const { edits, names } = progress;
  if (edits === 0) return "Drafting the change…";
  return `Drafting ${edits} ${edits === 1 ? "edit" : "edits"}${names.length > 0 ? `: ${names.join(", ")}` : ""}…`;
}

const assistantBubble = "max-w-[85%] self-start rounded-2xl rounded-bl-md bg-hover px-3 py-2";
const messageActions =
  "opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100";

export function AssistantTab({
  active,
  headerSlot,
  onShowProperties,
  modelSelection,
  onOpenSettings,
}: AssistantTabProps) {
  const { model, connectedProviders, setModel } = modelSelection;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState<AbortController>();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scope = useSelectionScope();

  useEffect(() => {
    if (active) composerRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (active && messages.length > 0) endRef.current?.scrollIntoView({ block: "end" });
  }, [active, messages]);

  const canSend = Boolean(draft.trim()) && !working;

  const say = (message: ChatMessage) => setMessages((current) => [...current, message]);
  const notice = (text: string): ChatMessage => ({ id: crypto.randomUUID(), kind: "notice", text });

  const history = messages.flatMap((message): Turn[] => {
    if (message.kind === "user") return [{ role: "user", text: message.text }];
    if (message.kind === "reply") return [{ role: "assistant", text: message.text }];
    return message.kind === "proposal"
      ? [{ role: "assistant", text: "(Proposed a change for the user to review.)" }]
      : [];
  });

  async function send() {
    if (!canSend) return;
    const request = draft.trim();
    say({ id: crypto.randomUUID(), kind: "user", text: request, scope });
    setDraft("");

    const provider = connectedProviders.find(({ id }) => id === model?.providerId);
    const access = model && modelSelection.access(model.providerId);
    if (!model || !provider || !access) return say(notice("No model is set up, so this went nowhere."));

    const controller = new AbortController();
    const reply = crypto.randomUUID();
    const { diagram, selection } = getAppState();
    setWorking(controller);
    say({ id: reply, kind: "reply", text: "", status: "Thinking…" });
    const update = (changes: { text?: string; status?: string }) =>
      setMessages((current) => current.map((message) => (message.id === reply ? { ...message, ...changes } : message)));
    try {
      const result = await runAssistant({
        model: provider.languageModel(model.id, access),
        history,
        diagram,
        request,
        selected: selection,
        signal: controller.signal,
        onText: (text) => update({ text }),
        onProgress: (progress) => update({ status: describeProgress(progress) }),
      });
      if (result.operations) {
        const [issue] = propose(result.operations);
        const { proposal } = getAppState();
        say(
          issue || !proposal
            ? notice(`The proposal no longer fits the diagram. ${issue?.message ?? ""}`)
            : { id: crypto.randomUUID(), kind: "proposal", proposal },
        );
      } else if (result.problems) {
        say(notice(`${model.label} could not make a valid change:\n${result.problems}`));
      } else if (!result.text) {
        say(notice(`${model.label} gave no answer.`));
      }
    } catch (error) {
      // Stopped by the user, who can see where it stopped.
      if (!controller.signal.aborted) say(notice(explainError(provider, model.id, error)));
    } finally {
      setMessages((current) =>
        current
          .filter((message) => message.id !== reply || (message.kind === "reply" && message.text))
          .map((message) => (message.id === reply ? { ...message, status: undefined } : message)),
      );
      setWorking(undefined);
    }
  }

  return (
    <>
      {active &&
        headerSlot &&
        messages.length > 0 &&
        createPortal(
          <button
            type="button"
            onClick={() => {
              working?.abort();
              setMessages([]);
              dismissProposal();
              composerRef.current?.focus();
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <Eraser size={13} strokeWidth={1.75} />
            Clear chat
          </button>,
          headerSlot,
        )}

      <div role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <p className={assistantBubble}>
          Hi! Ask about your diagram, have it reviewed, or tell me what to build or change.
        </p>
        {!model && <p className={assistantBubble}>To get started, set up a model below.</p>}
        {messages.map((message) =>
          message.kind === "user" ? (
            <div key={message.id} className="group/message flex flex-col items-end gap-1">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 whitespace-pre-wrap wrap-anywhere text-surface">
                {message.text}
              </p>
              <div className="flex items-center gap-1">
                <div className={messageActions}>
                  <CopyButton text={message.text} />
                </div>
                {message.scope && <p className="text-[11px] text-muted">{message.scope}</p>}
              </div>
            </div>
          ) : message.kind === "reply" ? (
            <div key={message.id} className="group/message flex flex-col items-start gap-1">
              {message.text && (
                <div className={`${assistantBubble} wrap-anywhere`}>
                  <Reply text={message.text} />
                </div>
              )}
              {message.status && (
                <p role="status" className="flex max-w-[85%] items-start gap-1.5 px-1 text-xs text-muted">
                  <LoaderCircle size={12} className="mt-0.5 shrink-0 animate-spin" />
                  <span className="line-clamp-2">{message.status}</span>
                </p>
              )}
              {message.text && !message.status && (
                <div className={messageActions}>
                  <CopyButton text={message.text} />
                </div>
              )}
            </div>
          ) : message.kind === "proposal" ? (
            <ProposalCard key={message.id} proposal={message.proposal} />
          ) : (
            <p
              key={message.id}
              className="flex items-start gap-2 rounded-xl bg-hover px-3 py-2 text-xs whitespace-pre-wrap text-muted"
            >
              <Info size={14} className="mt-px shrink-0" />
              {message.text}
            </p>
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        className="m-2 mt-0 rounded-xl border border-line p-2.5 shadow-sm transition-colors focus-within:border-accent"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {scope && (
          <button
            type="button"
            title="Show properties"
            onClick={onShowProperties}
            className="mb-2 flex w-fit max-w-full items-center gap-1.5 rounded-md bg-accent/10 py-0.5 pr-1 pl-1.5 text-xs text-accent hover:bg-accent/20"
          >
            <MousePointerClick size={12} className="shrink-0" />
            <span className="truncate">{scope}</span>
            <ChevronRight size={12} className="shrink-0" />
          </button>
        )}
        <div className="grid max-h-40 grid-cols-[minmax(0,1fr)] overflow-y-auto">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre-wrap wrap-anywhere">
            {draft}
            {/* A zero-width space keeps a line's height when the text is empty or ends in a new line. */}
            {"\u200b"}
          </span>
          <textarea
            ref={composerRef}
            aria-label="Message"
            rows={1}
            value={draft}
            placeholder="Ask, review or change your diagram"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
            className="col-start-1 row-start-1 resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted"
          />
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
          <span className="flex-1" />
          {model ? (
            <label className="relative flex min-w-0 items-center hover:text-fg">
              <select
                aria-label="Model"
                title="Model"
                value={`${model.providerId} ${model.id}`}
                onChange={(event) => {
                  const [providerId, ...modelId] = event.target.value.split(" ");
                  if (event.target.value === MANAGE_MODELS) onOpenSettings();
                  else setModel(providerId, modelId.join(" "));
                }}
                className="min-w-0 appearance-none truncate bg-transparent py-1 pr-4 text-right outline-none"
              >
                {connectedProviders.map((provider) => (
                  <optgroup key={provider.id} label={provider.label}>
                    {provider.models.map((option) => (
                      <option key={option.id} value={`${provider.id} ${option.id}`}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <hr />
                <option value={MANAGE_MODELS}>Manage models…</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-0" />
            </label>
          ) : (
            <button type="button" onClick={onOpenSettings} className="font-medium text-accent hover:underline">
              Set up a model
            </button>
          )}
          {working ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              onClick={() => working.abort()}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-surface transition-opacity hover:opacity-90"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              title="Send (Enter)"
              disabled={!canSend}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-surface transition-opacity hover:opacity-90 disabled:opacity-35"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </form>
    </>
  );
}
