import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { runAssistant } from "../../../agents/assistant";
import type { DiagramObject } from "../../../diagram/schema";
import { providers } from "../../../providers";
import { boundary, component, diagram, seed, undoLabels } from "../../../test/diagram";
import { button, modelSelection } from "../../../test/dom";
import { exampleProposal } from "../../../test/exampleProposal";
import { addObject, getAppState, pendingProposal, remove } from "../../state";
import { AssistantTab } from "../AssistantTab";

vi.mock("../../../agents/assistant", () => ({ runAssistant: vi.fn() }));

beforeEach(() => {
  vi.mocked(runAssistant).mockImplementation(async ({ diagram, onText }) => {
    onText("Here is a change.");
    return { text: "Here is a change.", operations: exampleProposal(diagram) };
  });
});

const api = component("api", "API");

function setup({ connected = false, nodes = [] as DiagramObject[], selected = [] as string[], active = true } = {}) {
  seed(nodes, [], selected);
  const onOpenSettings = vi.fn();
  const onShowProperties = vi.fn();
  const setModel = vi.fn();
  const connectedProviders = connected ? providers : [];
  const selection = modelSelection({
    connectedProviders,
    model: connectedProviders[0] && { ...connectedProviders[0].models[0], providerId: connectedProviders[0].id },
    setModel,
    access: vi.fn(() => ({ fetch: vi.fn() })),
  });
  const headerSlot = document.createElement("div");
  document.body.append(headerSlot);
  const panel = (isActive: boolean) => (
    <AssistantTab
      active={isActive}
      headerSlot={headerSlot}
      onShowProperties={onShowProperties}
      modelSelection={selection}
      onOpenSettings={onOpenSettings}
    />
  );
  const view = render(panel(active));
  const composer = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
  return {
    onOpenSettings,
    setModel,
    composer,
    user: userEvent.setup(),
    headerSlot,
    onShowProperties,
    activate: () => view.rerender(panel(true)),
  };
}

const sendButton = () => button("Send") as HTMLButtonElement;

test("opens with a greeting and takes focus when it comes on screen", () => {
  const { composer, activate } = setup({ active: false });
  screen.getByText(/Ask about your diagram/);
  expect(document.activeElement).not.toBe(composer);
  activate();
  expect(document.activeElement).toBe(composer);
});

test("points to Settings while no model is set up", async () => {
  const { user, onOpenSettings } = setup();
  screen.getByText(/set up a model below/);
  expect(screen.queryByRole("combobox", { name: "Model" })).toBeNull();
  await user.click(button("Set up a model"));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

test("lists the models of connected providers", async () => {
  const { user, setModel, onOpenSettings } = setup({ connected: true });
  expect(screen.queryByText(/set up a model below/)).toBeNull();
  const picker = screen.getByRole("combobox", { name: "Model" });
  expect(picker).toHaveProperty("value", "anthropic claude-opus-5-5");
  screen.getByRole("group", { name: "OpenAI" });

  await user.selectOptions(picker, "Claude Haiku 5.5");
  expect(setModel).toHaveBeenCalledWith("anthropic", "claude-haiku-5-5");

  setModel.mockClear();
  await user.selectOptions(picker, "Manage models…");
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
  expect(setModel).not.toHaveBeenCalled();
});

test("sends on Enter and says the request went nowhere", async () => {
  const { user, composer } = setup();
  expect(sendButton().disabled).toBe(true);

  await user.type(composer, "Add a cache{Enter}");
  screen.getByText("Add a cache");
  screen.getByText("No model is set up, so this went nowhere.");
  expect(composer.value).toBe("");
});

test("Shift+Enter adds a line instead of sending", async () => {
  const { user, composer } = setup();
  await user.type(composer, "one{Shift>}{Enter}{/Shift}two");
  expect(composer.value).toBe("one\ntwo");
  expect(screen.queryByText(/went nowhere/)).toBeNull();
});

test("scopes a request to the selected nodes", async () => {
  const { user, composer } = setup({
    nodes: [api, component("db", ""), component("web", "Web")],
    selected: ["api", "db"],
  });
  screen.getByText("API, Untitled");
  await user.type(composer, "Explain{Enter}");
  expect(screen.getAllByText("API, Untitled")).toHaveLength(2);
});

test("a selected group's request covers what is inside it, and says so", () => {
  setup({
    nodes: [
      boundary("g", { name: "Payments" }),
      component("api", "API", "service", { parent: "g" }),
      component("db", "DB", "database", { parent: "g" }),
    ],
    selected: ["g"],
  });
  screen.getByText("Payments (+2 inside)");
});

test("an unnamed boundary is called what the canvas calls it", () => {
  setup({
    nodes: [boundary("g", { name: "", kind: "team" })],
    selected: ["g"],
  });
  screen.getByText("Unnamed team");
});

test("summarises a large selection", () => {
  const names = ["A", "B", "C", "D"];
  setup({ nodes: names.map((name) => component(name, name)), selected: names });
  screen.getByText("A, B +2");
});

test("Clear chat appears in the header once there is a conversation and clears it", async () => {
  const { user, composer, headerSlot } = setup();
  expect(screen.queryByRole("button", { name: "Clear chat" })).toBeNull();
  await user.type(composer, "Add a cache{Enter}");

  expect(headerSlot.contains(button("Clear chat"))).toBe(true);
  await user.click(button("Clear chat"));
  expect(screen.queryByText("Add a cache")).toBeNull();
  screen.getByText(/Ask about your diagram/);
});

test("Clear chat is not offered while the chat is off screen", () => {
  setup({ active: false });
  expect(screen.queryByRole("button", { name: "Clear chat" })).toBeNull();
});

test("the selection chip leads to the selection's properties", async () => {
  const { user, onShowProperties } = setup({ nodes: [api], selected: ["api"] });
  await user.click(button("API"));
  expect(onShowProperties).toHaveBeenCalledTimes(1);
});

test("there is no selection chip when nothing is selected", () => {
  setup({ nodes: [api] });
  expect(screen.queryByTitle("Show properties")).toBeNull();
});

const proposal = () => within(screen.getByRole("region", { name: "Proposed change" }));
const names = () => diagram().objects.map((object) => ("name" in object ? object.name : object.text));

test("an edit request gets a proposal, and nothing changes until it is accepted", async () => {
  const { user, composer } = setup({ connected: true });
  await user.type(composer, "Build me a shop{Enter}");
  proposal().getByText("5 to decide");
  proposal().getByText("Web → API");
  expect(diagram().objects).toEqual([]);
  expect(pendingProposal(getAppState())?.preview.objects).toHaveLength(3);

  await user.hover(proposal().getByText("Orders database"));
  expect(getAppState().focus).toBe(pendingProposal(getAppState())?.preview.objects[2].id);

  await user.click(proposal().getByRole("button", { name: "Accept all" }));
  expect(names()).toEqual(["Web", "API", "Orders database"]);
  expect(diagram().connections).toHaveLength(2);
  expect(undoLabels()).toEqual(["Assistant edit"]);
  proposal().getByText("5 accepted");
  expect(pendingProposal(getAppState())).toBeUndefined();
  expect(proposal().queryByRole("button")).toBeNull();
});

test("a rejected proposal changes nothing", async () => {
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  await user.click(proposal().getByRole("button", { name: "Reject all" }));
  proposal().getByText("3 rejected");
  expect(pendingProposal(getAppState())).toBeUndefined();
  expect(names()).toEqual(["API"]);
  expect(undoLabels()).toEqual([]);
});

test("a proposal stays on offer through other edits, and drops what no longer applies", async () => {
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  act(() => addObject(component("db", "DB"), "Add database"));
  proposal().getByText("3 to decide");

  act(() => remove(["api"]));
  proposal().getByText("1 to decide · 2 out of date");
  await user.click(proposal().getByRole("button", { name: "Accept the rest" }));
  expect(names()).toEqual(["DB", "Monitoring"]);
});

test("a newer proposal replaces the one before it", async () => {
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  await user.type(composer, "Again{Enter}");
  const [older, newer] = screen.getAllByRole("region", { name: "Proposed change" });
  within(older).getByText("3 out of date");
  within(newer).getByRole("button", { name: "Accept all" });
});

test("clearing the chat drops the proposal", async () => {
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  await user.click(button("Clear chat"));
  expect(getAppState().proposal).toBeUndefined();
});

test("with no model set up, an edit request goes nowhere", async () => {
  const { user, composer } = setup({ nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  screen.getByText("No model is set up, so this went nowhere.");
  expect(runAssistant).not.toHaveBeenCalled();
  expect(getAppState().proposal).toBeUndefined();
});

test("the reply streams in above the proposal", async () => {
  let finish = () => {};
  vi.mocked(runAssistant).mockImplementationOnce(
    ({ diagram, onText }) =>
      new Promise((resolve) => {
        onText("Adding");
        finish = () => {
          onText("Adding monitoring.");
          resolve({ text: "Adding monitoring.", operations: exampleProposal(diagram) });
        };
      }),
  );
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  screen.getByText("Adding");
  expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  act(() => finish());
  await screen.findByText("Adding monitoring.");
  proposal().getByText("3 to decide");
  button("Send");
});

test("while nothing is said yet, a status line shows what the model is doing", async () => {
  let finish = () => {};
  vi.mocked(runAssistant).mockImplementationOnce(
    ({ diagram, onProgress }) =>
      new Promise((resolve) => {
        onProgress({ stage: "drafting", edits: 0, names: [] });
        finish = () => resolve({ text: "", operations: exampleProposal(diagram) });
      }),
  );
  const { user, composer } = setup({ connected: true, nodes: [api] });
  const status = () => screen.getByRole("status");
  await user.type(composer, "Monitor it{Enter}");
  expect(status().textContent).toBe("Drafting the change…");

  const { onProgress } = vi.mocked(runAssistant).mock.calls[0][0];
  act(() => onProgress({ stage: "drafting", edits: 3, names: ["Monitoring"] }));
  expect(status().textContent).toBe("Drafting 3 edits: Monitoring…");
  act(() => onProgress({ stage: "correcting" }));
  expect(status().textContent).toBe("Fixing a problem in the draft…");

  await act(async () => finish());
  expect(screen.queryByRole("status")).toBeNull();
  proposal().getByText("3 to decide");
});

test("the request carries the model, the selection and the conversation so far", async () => {
  vi.mocked(runAssistant).mockImplementationOnce(async ({ onText }) => {
    onText("Which database?");
    return { text: "Which database?" };
  });
  const { user, composer } = setup({ connected: true, nodes: [api], selected: ["api"] });
  await user.type(composer, "Add a cache{Enter}");
  await screen.findByText("Which database?");
  expect(screen.queryByRole("region", { name: "Proposed change" })).toBeNull();

  await user.type(composer, "The orders one{Enter}");
  await waitFor(() => expect(runAssistant).toHaveBeenCalledTimes(2));
  expect(vi.mocked(runAssistant).mock.calls[1][0]).toMatchObject({
    request: "The orders one",
    selected: ["api"],
    history: [
      { role: "user", text: "Add a cache" },
      { role: "assistant", text: "Which database?" },
    ],
  });
  expect(vi.mocked(runAssistant).mock.calls[1][0].model).toMatchObject({ modelId: "claude-opus-5-5" });
});

test("Stop calls the request off and leaves no empty reply", async () => {
  vi.mocked(runAssistant).mockImplementationOnce(
    ({ signal }) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
  );
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  screen.getByText("Thinking…");
  await user.click(button("Stop"));
  await screen.findByRole("button", { name: "Send" });
  expect(screen.queryByText("Thinking…")).toBeNull();
  expect(getAppState().proposal).toBeUndefined();
});

test("a reply can be copied once it has finished, and so can what the user sent", async () => {
  let finish = () => {};
  vi.mocked(runAssistant).mockImplementationOnce(
    ({ onText }) =>
      new Promise((resolve) => {
        onText("**It** absorbs bursts.");
        finish = () => resolve({ text: "**It** absorbs bursts." });
      }),
  );
  const { user, composer } = setup({ connected: true });
  await user.type(composer, "Why a queue?{Enter}");
  await screen.findByText("It");
  expect(screen.getAllByRole("button", { name: "Copy message" })).toHaveLength(1);

  await act(async () => finish());
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Copy message" })).toHaveLength(2));
  await user.click(screen.getAllByRole("button", { name: "Copy message" })[1]);
  expect(await navigator.clipboard.readText()).toBe("**It** absorbs bursts.");
});

test("a model that gives no answer is reported", async () => {
  vi.mocked(runAssistant).mockResolvedValueOnce({ text: "" });
  const { user, composer } = setup({ connected: true });
  await user.type(composer, "Why a queue?{Enter}");
  await screen.findByText("Claude Opus 5.5 gave no answer.");
});

test("a failed request says why", async () => {
  vi.mocked(runAssistant).mockRejectedValueOnce(new Error("Anthropic is having problems right now."));
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  await screen.findByText("Anthropic is having problems right now.");
  expect(screen.queryByText("Thinking…")).toBeNull();
});

test("a proposal the model could not get right is not offered, and what was wrong is shown", async () => {
  vi.mocked(runAssistant).mockResolvedValueOnce({ text: "", problems: "Operation 0: There is no object nowhere." });
  const { user, composer } = setup({ connected: true, nodes: [api] });
  await user.type(composer, "Monitor it{Enter}");
  await screen.findByText(/could not make a valid change:\s+Operation 0: There is no object nowhere\./);
  expect(getAppState().proposal).toBeUndefined();
});

test("accepting one change brings what it needs and leaves the rest proposed", async () => {
  const { user, composer } = setup({ connected: true });
  await user.type(composer, "Build me a shop{Enter}");
  await user.click(proposal().getByRole("button", { name: "Accept Web → API" }));
  expect(names()).toEqual(["Web", "API"]);
  expect(diagram().connections).toHaveLength(1);
  proposal().getByText("2 to decide · 3 accepted");

  await user.click(proposal().getByRole("button", { name: "Accept the rest" }));
  expect(names()).toEqual(["Web", "API", "Orders database"]);
  expect(undoLabels()).toEqual(["Assistant edit", "Assistant edit"]);
  proposal().getByText("5 accepted");
});

test("rejecting one change takes what depends on it and leaves the rest proposed", async () => {
  const { user, composer } = setup({ connected: true });
  await user.type(composer, "Build me a shop{Enter}");
  await user.click(proposal().getByRole("button", { name: "Reject Orders database" }));
  proposal().getByText("3 to decide · 2 rejected");
  expect(diagram().objects).toEqual([]);

  await user.click(proposal().getByRole("button", { name: "Accept the rest" }));
  expect(names()).toEqual(["Web", "API"]);
  expect(diagram().connections).toHaveLength(1);
});
