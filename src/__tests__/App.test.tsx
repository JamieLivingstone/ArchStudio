import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "../App";
import { button } from "../test/dom";
import { saveDiagram } from "../ui/files/saveDiagram";
import { getAppState, markSaved } from "../ui/state";

vi.mock("../tauri/window", () => ({
  setWindowTheme: vi.fn(),
  interceptWindowClose: () => () => {},
  closeWindow: vi.fn(),
}));
vi.mock("../providers", async (original) => ({
  ...(await original<typeof import("../providers")>()),
  testConnection: vi.fn(async (provider: { models: unknown[] }) => provider.models),
}));
vi.mock("../ui/files/saveDiagram", () => ({ saveDiagram: vi.fn() }));
vi.mock("../tauri/diagramFiles", () => ({
  fileName: (path: string) => path.split("/").pop() ?? path,
  hasNativeFiles: vi.fn(() => false),
  pickDiagramFile: vi.fn(),
  listenForDroppedFile: () => () => {},
  readDiagramFile: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  delete document.documentElement.dataset.theme;
});

function setup() {
  const { container } = render(<App />);
  fireEvent.click(button(/New diagram/));
  return {
    settings: container.querySelector("dialog") as HTMLDialogElement,
    user: userEvent.setup(),
  };
}

test("settings open from the toolbar and from Cmd/Ctrl+comma", async () => {
  const { settings, user } = setup();
  expect(settings.open).toBe(false);
  await user.click(button("Settings"));
  expect(settings.open).toBe(true);

  await user.click(button("Close settings"));
  expect(settings.open).toBe(false);

  fireEvent.keyDown(document, { key: ",", metaKey: true });
  expect(settings.open).toBe(true);
});

test("the theme setting applies to the page and the canvas", async () => {
  const { user } = setup();
  const canvas = document.querySelector(".react-flow") as HTMLElement;
  fireEvent.keyDown(document, { key: ",", ctrlKey: true });
  await user.click(button("Dark"));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(canvas.classList.contains("dark")).toBe(true);
});

test("a provider connected in settings supplies the assistant's model", async () => {
  const { user } = setup();
  await user.click(button("Show panel"));
  await user.click(button("Set up a model"));

  const openai = within(screen.getByRole("region", { name: "OpenAI" }));
  await user.type(openai.getByLabelText("OpenAI API key"), "sk-proj-abcdefghijklmnopqrstuvwxyz");
  await user.click(openai.getByRole("button", { name: "Check and connect" }));
  await openai.findByText("Connected");
  await user.click(button("Close settings"));

  expect(screen.getByRole("combobox", { name: "Model" })).toHaveProperty("value", "openai gpt-6-astra");
});

test("starts with the landing dialog over the canvas, which stays while a template is laid out", async () => {
  const { container } = render(<App />);
  expect(container.querySelector(".react-flow")).not.toBeNull();

  await userEvent.setup().click(button(/Real-time chat/));
  expect(button(/Real-time chat/).getAttribute("aria-busy")).toBe("true");
  expect(button(/New diagram/).closest("[inert]")).not.toBeNull();
  expect(container.querySelectorAll(".react-flow__node")).toHaveLength(13);

  await waitFor(() => expect(screen.queryByRole("button", { name: /New diagram/ })).toBeNull(), { timeout: 4000 });
  expect(container.querySelector(".react-flow.arranging")).toBeNull();
  screen.getByText("Real-time chat.json");
});

test("the header names the file, marks unsaved changes and saves", async () => {
  vi.mocked(saveDiagram).mockResolvedValue("saved");
  const { user } = setup();
  expect(screen.getByText("Untitled")).toBeTruthy();

  await user.click(button("Text"));
  await user.dblClick(button("Text"));
  expect(screen.getByText("Untitled · Edited")).toBeTruthy();

  await user.click(button("Save"));
  fireEvent.keyDown(document, { key: "s", metaKey: true });
  expect(saveDiagram).toHaveBeenCalledTimes(2);

  markSaved(getAppState().diagram, { name: "orders.json" });
  expect(await screen.findByText("orders.json")).toBeTruthy();
});

test("a failed save is shown in the header", async () => {
  vi.mocked(saveDiagram).mockRejectedValue(new Error("Disk full"));
  const { user } = setup();
  await user.click(button("Save"));
  expect((await screen.findByRole("alert")).textContent).toBe("Could not save. Disk full");
});

test("a file that is not a diagram is refused in the landing dialog, and closing it clears the reason", async () => {
  const { user } = setup();
  await user.click(button("Home"));
  const notes = new File(["{}"], "notes.json", { type: "application/json" });
  await user.upload(screen.getByLabelText("Diagram file"), notes);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Could not open notes.json. This file is not an ArchStudio diagram.",
  );
  await user.click(button("Close"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("Home brings the landing dialog back, and closing it keeps the diagram", async () => {
  const { user } = setup();
  await user.dblClick(button("Text"));
  await user.click(button("Home"));
  await user.click(button("Close"));
  expect(screen.queryByRole("button", { name: /New diagram/ })).toBeNull();
  expect(getAppState().diagram.objects).toHaveLength(1);
});

async function leaveUnsaved() {
  const { user } = setup();
  await user.dblClick(button("Text"));
  await user.click(button("Home"));
  await user.click(button(/New diagram/));
  const asking = () => screen.queryByRole("dialog", { name: "Save changes to Untitled?" });
  expect(asking()).not.toBeNull();
  return { user, asking };
}

test("starting another diagram with unsaved changes asks first, and Cancel keeps everything", async () => {
  const { user, asking } = await leaveUnsaved();
  await user.click(button("Cancel"));
  expect(asking()).toBeNull();
  expect(getAppState().diagram.objects).toHaveLength(1);
  expect(button(/New diagram/)).toBeTruthy();
});

test("Discard carries on without saving", async () => {
  const { user, asking } = await leaveUnsaved();
  await user.click(button("Discard"));
  expect(asking()).toBeNull();
  expect(saveDiagram).not.toHaveBeenCalled();
  expect(getAppState().diagram.objects).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /New diagram/ })).toBeNull();
});

test("Save carries on once saved, but not if the save did not happen", async () => {
  vi.mocked(saveDiagram).mockResolvedValue("cancelled");
  const { user, asking } = await leaveUnsaved();
  await user.click(within(asking() as HTMLElement).getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(asking()).toBeNull());
  expect(getAppState().diagram.objects).toHaveLength(1);

  vi.mocked(saveDiagram).mockImplementation(async () => {
    markSaved(getAppState().diagram, { name: "kept.json" });
    return "saved";
  });
  await user.click(button(/New diagram/));
  await user.click(within(asking() as HTMLElement).getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(getAppState().diagram.objects).toHaveLength(0));
  expect(screen.queryByRole("button", { name: /New diagram/ })).toBeNull();
});
