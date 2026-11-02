import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { seed, shape } from "../../../test/diagram";
import { button } from "../../../test/dom";
import { renderImage } from "../../canvas/exportImage";
import { getAppState, loadDiagram, markSaved } from "../../state";
import { ExportButton } from "../ExportButton";
import { saveImage } from "../saveImage";

vi.mock("../../canvas/exportImage", () => ({ renderImage: vi.fn(async () => image) }));
vi.mock("../saveImage", () => ({ saveImage: vi.fn() }));

const image = vi.hoisted(() => new Blob(["image"]));

function setup() {
  const onError = vi.fn();
  render(<ExportButton className="" onError={onError} />);
  return { onError };
}

beforeEach(() => {
  vi.clearAllMocks();
  seed([shape("a", "Box", "rectangle")], [], ["a"]);
});

test("nothing can be exported from an empty diagram", () => {
  loadDiagram({ schemaVersion: 1, objects: [], connections: [] });
  setup();
  expect(button("Export PNG").disabled).toBe(true);
});

test("exports without touching the selection, named after the file", async () => {
  markSaved(getAppState().diagram, { name: "orders.json" });
  const { onError } = setup();
  await userEvent.click(button("Export PNG"));
  await waitFor(() => expect(saveImage).toHaveBeenCalledWith(image, "orders.png"));
  expect(getAppState().selection).toEqual(["a"]);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith("");
});

test("an unsaved diagram is exported as Untitled", async () => {
  setup();
  await userEvent.click(button("Export PNG"));
  await waitFor(() => expect(saveImage).toHaveBeenCalledWith(image, "Untitled.png"));
});

test("a failed export says why and can be tried again", async () => {
  vi.mocked(renderImage).mockRejectedValueOnce(new Error("The canvas is not ready."));
  const { onError } = setup();
  await userEvent.click(button("Export PNG"));
  await waitFor(() => expect(onError).toHaveBeenLastCalledWith("Could not export. The canvas is not ready."));
  await waitFor(() => expect(button("Export PNG").disabled).toBe(false));
});
