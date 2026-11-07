import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { isDesktop } from "../../../tauri/providers";
import { openLink } from "../../../tauri/window";
import { button, modelSelection } from "../../../test/dom";
import { SettingsDialog } from "../SettingsDialog";
import type { Theme } from "../useTheme";

vi.mock("../../../tauri/providers", () => ({ isDesktop: vi.fn(() => true) }));
vi.mock("../../../tauri/window", () => ({ openLink: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDesktop).mockReturnValue(true);
});

const key = "sk-ant-api03-abcdefghijklmnop";

function setup({ open = true, theme = "system" as Theme, connected = [] as string[] } = {}) {
  const onClose = vi.fn();
  const onThemeChange = vi.fn();
  const connect = vi.fn(async () => {});
  const disconnect = vi.fn(async () => {});
  const selection = modelSelection({ connected, connect, disconnect });
  const props = { onClose, theme, onThemeChange, modelSelection: selection };
  const view = render(<SettingsDialog open={open} {...props} />);
  const dialog = view.container.querySelector("dialog") as HTMLDialogElement;
  const provider = (name: string) => within(screen.getByRole("region", { name }));
  return { ...view, props, dialog, provider, onClose, onThemeChange, connect, disconnect };
}

test("opens and closes with the open prop", () => {
  const { dialog, rerender, props } = setup({ open: false });
  expect(dialog.open).toBe(false);
  rerender(<SettingsDialog open {...props} />);
  expect(dialog.open).toBe(true);
  rerender(<SettingsDialog open={false} {...props} />);
  expect(dialog.open).toBe(false);
});

test("closes from its button, the backdrop and the native close event", async () => {
  const { dialog, onClose } = setup();
  await userEvent.click(button("Close settings"));
  expect(onClose).toHaveBeenCalledTimes(1);

  fireEvent.click(dialog);
  expect(onClose).toHaveBeenCalledTimes(2);

  fireEvent(dialog, new Event("close"));
  expect(onClose).toHaveBeenCalledTimes(3);
});

test("stays open when the click is inside the dialog", async () => {
  const { onClose } = setup();
  await userEvent.click(screen.getByRole("heading", { name: "Models" }));
  expect(onClose).not.toHaveBeenCalled();
});

test("shows the current theme and changes it", async () => {
  const { onThemeChange } = setup({ theme: "light" });
  expect(button("Light").getAttribute("aria-pressed")).toBe("true");
  expect(button("Dark").getAttribute("aria-pressed")).toBe("false");
  await userEvent.click(button("Dark"));
  expect(onThemeChange).toHaveBeenCalledWith("dark");
});

test("checks and saves a pasted key, hidden unless asked to show it", async () => {
  const { provider, connect } = setup();
  const anthropic = provider("Anthropic");
  const save = anthropic.getByRole("button", { name: "Check and save" });
  const field = anthropic.getByLabelText("Anthropic API key");
  expect(save).toHaveProperty("disabled", true);
  expect(field).toHaveProperty("type", "password");
  anthropic.getByText("Not connected");

  await userEvent.type(field, ` ${key}`);
  await userEvent.click(anthropic.getByRole("button", { name: "Show key" }));
  expect(field).toHaveProperty("type", "text");
  await userEvent.click(save);
  expect(connect).toHaveBeenCalledWith("anthropic", key, expect.any(AbortSignal));
  expect(field).toHaveProperty("value", "");
});

test("something that could not be a key is refused before it goes anywhere", async () => {
  const { provider, connect } = setup();
  const anthropic = provider("Anthropic");
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), "too short");
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect(anthropic.getByRole("alert").textContent).toMatch(/does not look like an API key/);
  expect(connect).not.toHaveBeenCalled();
});

test("a key of an unusual shape is pointed out, but still saved", async () => {
  const { provider, connect } = setup();
  const anthropic = provider("Anthropic");
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), "pk-abcdefghijklmnopqrstuvwxyz");
  anthropic.getByText(/keys usually start with/);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect(connect).toHaveBeenCalledTimes(1);
});

test("a key that could not be saved says why and stays to be tried again", async () => {
  const { provider, connect } = setup();
  connect.mockRejectedValueOnce("The system keychain is not available.");
  const anthropic = provider("Anthropic");
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), key);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect((await anthropic.findByRole("alert")).textContent).toBe("The system keychain is not available.");
  expect(anthropic.getByLabelText("Anthropic API key")).toHaveProperty("value", key);
});

test("a saved key is never shown, and can be replaced or removed", async () => {
  const { provider, connect, disconnect } = setup({ connected: ["anthropic"] });
  const anthropic = provider("Anthropic");
  anthropic.getByText("Connected");
  anthropic.getByText("Key saved in your system keychain");
  expect(anthropic.queryByLabelText("Anthropic API key")).toBeNull();

  await userEvent.click(anthropic.getByRole("button", { name: "Replace" }));
  await userEvent.click(anthropic.getByRole("button", { name: "Cancel" }));
  await userEvent.click(anthropic.getByRole("button", { name: "Replace" }));
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), key);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect(connect).toHaveBeenCalledWith("anthropic", key, expect.any(AbortSignal));
  await anthropic.findByText("Key saved in your system keychain");

  await userEvent.click(anthropic.getByRole("button", { name: "Remove" }));
  expect(disconnect).toHaveBeenCalledWith("anthropic");
});

test("a key that could not be removed says why", async () => {
  const { provider, disconnect } = setup({ connected: ["anthropic"] });
  disconnect.mockRejectedValueOnce("Could not remove the key from the system keychain.");
  await userEvent.click(provider("Anthropic").getByRole("button", { name: "Remove" }));
  expect((await provider("Anthropic").findByRole("alert")).textContent).toMatch(/Could not remove/);
});

test("a browser says keys stay in the tab until it is closed", () => {
  vi.mocked(isDesktop).mockReturnValue(false);
  const { provider } = setup({ connected: ["openai"] });
  provider("Anthropic").getByRole("button", { name: "Check and connect" });
  provider("OpenAI").getByText("Key kept in this tab until you close it");
  screen.getByText(/only go to the provider you use. Keys stay in this tab until you close it/);
});

test("shows which version this is, for bug reports", () => {
  setup();
  screen.getByText(/^Version \d+\.\d+\.\d+/);
});

test("points to the best practices for keys", async () => {
  setup();
  await userEvent.click(screen.getByRole("link", { name: /Key best practices/ }));
  expect(openLink).toHaveBeenCalledWith("https://github.com/JamieLivingstone/ArchStudio#api-key-best-practices");
});

test("points to where a key comes from", async () => {
  const { provider } = setup();
  await userEvent.click(provider("OpenAI").getByRole("link", { name: /Get a key/ }));
  expect(openLink).toHaveBeenCalledWith("https://platform.openai.com/api-keys");
});

test("says where a diagram goes", () => {
  setup();
  screen.getByText(/Your diagram and key only go to the provider you use/);
});

test("while a connection is being tried the button says so and cannot be pressed again", async () => {
  const { provider, connect } = setup();
  let finish = () => {};
  connect.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
  const anthropic = provider("Anthropic");
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), key);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect(anthropic.getByRole("button", { name: "Checking…" })).toHaveProperty("disabled", true);
  finish();
  await anthropic.findByRole("button", { name: "Check and save" });
});

test("cancelling a replacement calls off the key being checked", async () => {
  const { provider, connect } = setup({ connected: ["anthropic"] });
  connect.mockReturnValueOnce(new Promise<void>(() => {}));
  const anthropic = provider("Anthropic");
  await userEvent.click(anthropic.getByRole("button", { name: "Replace" }));
  await userEvent.type(anthropic.getByLabelText("Anthropic API key"), key);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  const [, , signal] = connect.mock.calls[0] as unknown as [string, string, AbortSignal];
  expect(signal.aborted).toBe(false);

  await userEvent.click(anthropic.getByRole("button", { name: "Cancel" }));
  expect(signal.aborted).toBe(true);
  anthropic.getByText("Key saved in your system keychain");
});

test("after a key fails, pasting another takes its place, and a replacement says the old key is still in use", async () => {
  const { provider, connect } = setup({ connected: ["anthropic"] });
  connect.mockRejectedValueOnce(new Error("Anthropic did not accept this key."));
  const anthropic = provider("Anthropic");
  await userEvent.click(anthropic.getByRole("button", { name: "Replace" }));
  const field = anthropic.getByLabelText("Anthropic API key");
  await userEvent.type(field, `${key}-wrong`);
  await userEvent.click(anthropic.getByRole("button", { name: "Check and save" }));
  expect((await anthropic.findByRole("alert")).textContent).toBe(
    "Anthropic did not accept this key. The key you connected before is still the one in use.",
  );

  await userEvent.paste(key);
  expect(field).toHaveProperty("value", key);
});
