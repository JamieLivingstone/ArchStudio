import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { button } from "../../test/dom";
import { ErrorBoundary } from "../ErrorBoundary";
import { saveDiagram } from "../files/saveDiagram";

vi.mock("../files/saveDiagram", () => ({ saveDiagram: vi.fn(async () => "saved") }));

function Broken(): never {
  throw new Error("Cannot read the canvas");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(saveDiagram).mockClear();
});

test("shows what it wraps while nothing has failed", () => {
  render(
    <ErrorBoundary>
      <p>The app</p>
    </ErrorBoundary>,
  );
  screen.getByText("The app");
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a failure says what went wrong instead of leaving a blank page", () => {
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole("alert").textContent).toContain("Cannot read the canvas");
});

test("the diagram can still be saved as a copy after a failure", async () => {
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  await userEvent.click(button("Save a copy"));
  expect(saveDiagram).toHaveBeenCalledWith({ as: true });
});

test("a copy that could not be saved says why", async () => {
  vi.mocked(saveDiagram).mockRejectedValueOnce(new Error("The disk is full."));
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  await userEvent.click(button("Save a copy"));
  await screen.findByText("Could not save. The disk is full.");
});
