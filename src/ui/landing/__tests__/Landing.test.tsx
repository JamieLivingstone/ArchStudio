import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { emptyDiagram } from "../../../diagram/schema";
import { hasNativeFiles, pickDiagramFile } from "../../../tauri/diagramFiles";
import { button } from "../../../test/dom";
import { Landing } from "../Landing";
import { templates } from "../templates";

vi.mock("../../../tauri/diagramFiles", () => ({
  fileName: (path: string) => path.split("/").pop() ?? path,
  hasNativeFiles: vi.fn(() => false),
  pickDiagramFile: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

function setup(error = "") {
  const onStart = vi.fn();
  const onOpenFile = vi.fn();
  const onOpenFailed = vi.fn();
  const onClose = vi.fn();
  render(
    <Landing error={error} onStart={onStart} onOpenFile={onOpenFile} onOpenFailed={onOpenFailed} onClose={onClose} />,
  );
  return { onStart, onOpenFile, onOpenFailed, onClose, user: userEvent.setup() };
}

const file = (text: string, name = "design.json") => new File([text], name, { type: "application/json" });

test("New diagram starts with an empty diagram", async () => {
  const { onStart, user } = setup();
  await user.click(button(/New diagram/));
  expect(onStart).toHaveBeenCalledWith(emptyDiagram());
});

test("every template is offered and starts with its diagram", async () => {
  const { onStart, user } = setup();
  for (const template of templates) {
    await user.click(button(new RegExp(template.name)));
    expect(onStart).toHaveBeenLastCalledWith(template.diagram, {
      file: { name: `${template.name}.json` },
      arrange: true,
    });
  }
  expect(screen.getByRole("region", { name: "Architectures" })).toBeTruthy();
});

test("in a browser, Open diagram opens the chosen file", async () => {
  const { onOpenFile, user } = setup();
  await user.upload(screen.getByLabelText("Diagram file"), file("{}"));
  await vi.waitFor(() => expect(onOpenFile).toHaveBeenCalledWith("{}", { name: "design.json" }));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("in the desktop app, Open diagram uses the native dialog and keeps the path", async () => {
  vi.mocked(hasNativeFiles).mockReturnValue(true);
  vi.mocked(pickDiagramFile).mockResolvedValue({ path: "/designs/orders.json", text: "{}" });
  const { onOpenFile, onOpenFailed, user } = setup();
  await user.click(button(/Open diagram/));
  await vi.waitFor(() =>
    expect(onOpenFile).toHaveBeenCalledWith("{}", { name: "orders.json", path: "/designs/orders.json" }),
  );

  const denied = new Error("Permission denied");
  vi.mocked(pickDiagramFile).mockRejectedValue(denied);
  await user.click(button(/Open diagram/));
  await vi.waitFor(() => expect(onOpenFailed).toHaveBeenCalledWith(denied));
  vi.mocked(hasNativeFiles).mockReturnValue(false);
});

test("says why a file could not be opened", () => {
  setup("Could not open notes.json. This file is not an ArchStudio diagram.");
  expect(screen.getByRole("alert").textContent).toBe(
    "Could not open notes.json. This file is not an ArchStudio diagram.",
  );
});

test("dismissing the dialog closes it without starting anything", async () => {
  const { onStart, onClose, user } = setup();
  await user.click(button("Close"));
  fireEvent(screen.getByRole("dialog"), new Event("close"));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onStart).not.toHaveBeenCalled();
});
