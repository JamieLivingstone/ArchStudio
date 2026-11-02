import { fireEvent, render, screen } from "@testing-library/react";
import { type EdgeProps, ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { ConnectionEdge } from "../ConnectionEdge";

const edits = vi.hoisted(() => ({ setConnectionLabel: vi.fn() }));
vi.mock("../../../state", () => edits);

vi.mock("@xyflow/react", async (importOriginal) => {
  const { createPortal } = await import("react-dom");
  const portal = (children: ReactNode) => createPortal(<div>{children}</div>, document.body);
  return {
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    BaseEdge: ({ path }: { path: string }) => <path data-testid="line" d={path} />,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => portal(children),
  };
});

beforeEach(() => vi.clearAllMocks());

function renderEdge(props: Partial<EdgeProps> = {}) {
  const edge = {
    id: "e1",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    sourcePosition: "right",
    targetPosition: "left",
    ...props,
  } as EdgeProps;
  return render(
    <ReactFlowProvider>
      <svg>
        <title>Edge</title>
        <ConnectionEdge {...edge} />
      </svg>
    </ReactFlowProvider>,
  );
}

const editor = () => screen.queryByRole("textbox", { name: "Label" }) as HTMLInputElement | null;

test("shows its label, and nothing when it has none", () => {
  const { unmount } = renderEdge({ label: "HTTPS" });
  screen.getByText("HTTPS");
  unmount();
  renderEdge();
  expect(document.querySelector(".border-line")).toBeNull();
});

test("double-clicking the line edits the label in place", () => {
  renderEdge({ label: "HTTPS" });
  expect(editor()).toBeNull();
  fireEvent.doubleClick(screen.getByTestId("line"));
  const input = editor();
  expect(document.activeElement).toBe(input);
  expect(input?.value).toBe("HTTPS");
});

test("double-clicking the label edits it too", () => {
  renderEdge({ label: "HTTPS" });
  fireEvent.doubleClick(screen.getByText("HTTPS"));
  expect(editor()).not.toBeNull();
});

test("an edge without a label can be given one", () => {
  renderEdge();
  fireEvent.doubleClick(screen.getByTestId("line"));
  fireEvent.change(editor() as HTMLInputElement, { target: { value: "gRPC" } });
  expect(edits.setConnectionLabel).toHaveBeenCalledWith("e1", "gRPC");
});

test.each(["Enter", "Escape"])("%s finishes editing", (key) => {
  renderEdge({ label: "HTTPS" });
  fireEvent.doubleClick(screen.getByTestId("line"));
  fireEvent.keyDown(editor() as HTMLInputElement, { key });
  expect(editor()).toBeNull();
  screen.getByText("HTTPS");
});

test("clicking away finishes editing", () => {
  renderEdge({ label: "HTTPS" });
  fireEvent.doubleClick(screen.getByTestId("line"));
  fireEvent.blur(editor() as HTMLInputElement);
  expect(editor()).toBeNull();
});

test("has no popover, even while selected", () => {
  renderEdge({ selected: true });
  expect(screen.queryByRole("button")).toBeNull();
});
