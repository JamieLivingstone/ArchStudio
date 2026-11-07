import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { component, diagram, objectAdd, seed } from "../../../test/diagram";
import { button } from "../../../test/dom";
import { acceptProposal, propose } from "../../state";
import { ProposalReview } from "../ProposalReview";

const fitView = vi.hoisted(() => vi.fn());
const fitDiagram = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useFitDiagram", async (original) => ({
  ...(await original<object>()),
  useFitDiagram: () => fitDiagram,
}));
vi.mock("@xyflow/react", () => ({
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({ getNode: vi.fn(), fitView, getNodesBounds: () => ({ width: 0 }) }),
  useStore: () => false,
}));

afterEach(() => {
  fitView.mockClear();
  fitDiagram.mockClear();
});

function setup() {
  seed([component("web")]);
  propose([objectAdd(component("api")), objectAdd(component("db"))]);
  render(<ProposalReview />);
}

test("is only there while a proposal is waiting", () => {
  seed([component("web")]);
  const { container } = render(<ProposalReview />);
  expect(container.textContent).toBe("");
});

test("accepts everything proposed", async () => {
  setup();
  screen.getByText(/2 to decide/);
  await userEvent.click(button("Accept all"));
  expect(diagram().objects.map(({ id }) => id)).toEqual(["web", "api", "db"]);
  expect(screen.queryByRole("button")).toBeNull();
});

test("rejects everything proposed", async () => {
  setup();
  await userEvent.click(button("Reject all"));
  expect(diagram().objects.map(({ id }) => id)).toEqual(["web"]);
  expect(screen.queryByRole("button")).toBeNull();
});

test("once part is decided, it offers the rest", () => {
  setup();
  act(() => {
    acceptProposal(["api"]);
  });
  screen.getByText(/1 to decide/);
  button("Accept the rest");
  button("Reject the rest");
});

test("once nothing is left to decide, the whole diagram is brought back into view", async () => {
  setup();
  expect(fitDiagram).not.toHaveBeenCalled();
  await userEvent.click(button("Reject all"));
  await vi.waitFor(() => expect(fitDiagram).toHaveBeenCalledTimes(1));
});

test("a fit still waiting when the canvas goes away never happens", async () => {
  setup();
  await userEvent.click(button("Reject all"));
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(fitDiagram).not.toHaveBeenCalled();
});
