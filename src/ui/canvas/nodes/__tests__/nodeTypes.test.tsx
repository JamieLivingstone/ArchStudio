import { fireEvent, render, screen, within } from "@testing-library/react";
import { Star } from "lucide-react";
import type { ComponentType } from "react";
import { expect, test, vi } from "vitest";
import { component, diagram, seed } from "../../../../test/diagram";
import { iconFor } from "../../../icons";
import { nodeTypes } from "../nodeTypes";

vi.mock("@xyflow/react", () => ({
  Handle: () => <div data-testid="handle" />,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  NodeResizer: ({
    isVisible,
    minWidth,
    onResizeStart,
  }: {
    isVisible: boolean;
    minWidth?: number;
    onResizeStart?: () => void;
  }) =>
    isVisible ? <div data-testid="resizer" data-min-width={minWidth} onPointerDown={() => onResizeStart?.()} /> : null,
}));

function renderNode(type: string, data: Record<string, unknown>) {
  const NodeComponent = nodeTypes[type] as ComponentType<{
    id: string;
    data: Record<string, unknown>;
    selected: boolean;
  }>;
  return render(<NodeComponent id="n1" data={data} selected={false} />);
}

test("registers every node type", () => {
  expect(Object.keys(nodeTypes).sort()).toEqual(["boundary", "component", "rectangle", "sphere", "text"]);
});

test("a text node shows its label, has a placeholder and cannot be connected", () => {
  const { unmount } = renderNode("text", { label: "Note" });
  screen.getByText("Note");
  expect(screen.queryAllByTestId("handle")).toEqual([]);
  unmount();

  renderNode("text", { label: "" });
  screen.getByText("Text");
});

test.each(["rectangle", "sphere"])("a %s shows its label and can be connected", (type) => {
  renderNode(type, { label: "Orders" });
  screen.getByText("Orders");
  expect(screen.getAllByTestId("handle")).toHaveLength(4);
  expect(screen.queryByRole("region")).toBeNull();
});

test("a sphere starts at its minimum size", () => {
  renderNode("sphere", { label: "" });
  const circle = document.querySelector(".rounded-full") as HTMLElement;
  expect(circle.style.width).toBe("112px");
  expect(circle.style.height).toBe("112px");
});

const nodeBody = (container: HTMLElement) => within(container.querySelector(".shadow-sm") as HTMLElement);

test("a component node shows its name and its kind", () => {
  const { container } = renderNode("component", { label: "Edge LB", kind: "loadBalancer" });
  const node = nodeBody(container);
  node.getByText("Edge LB");
  node.getByText("Load Balancer");
  expect(node.queryByRole("list", { name: "Tags" })).toBeNull();
});

test("a component node's name is edited in place", () => {
  const { container } = renderNode("component", { label: "Edge LB", kind: "loadBalancer" });
  fireEvent.doubleClick(nodeBody(container).getByText("Edge LB"));
  expect(nodeBody(container).getByRole("textbox", { name: "Label" })).toHaveProperty("value", "Edge LB");
});

test("an unnamed component node says so", () => {
  const { container } = renderNode("component", { label: "", kind: "webClient" });
  nodeBody(container).getByText("Untitled");
  nodeBody(container).getByText("Web Client");
});

test("a component node lists each setting beside its label, and its tags as pills", () => {
  const { container } = renderNode("component", {
    label: "Public LB",
    kind: "loadBalancer",
    options: { sticky: true, layer: "Layer 7" },
    tags: ["edge", "EU only"],
  });
  const node = nodeBody(container);
  const rows = [...(container.querySelector("dl")?.children ?? [])].map((cell) => cell.textContent);
  expect(rows).toEqual(["Layer", "Layer 7", "Sticky sessions", "On"]);
  const pills = within(node.getByRole("list", { name: "Tags" })).getAllByRole("listitem");
  expect(pills.map((pill) => pill.textContent)).toEqual(["edge", "EU only"]);
});

test("a component node with neither settings nor tags shows neither", () => {
  const { container } = renderNode("component", { label: "Site", kind: "webClient" });
  expect(nodeBody(container).queryByRole("list", { name: "Tags" })).toBeNull();
  expect(container.querySelector(".border-t")).toBeNull();
});

test("a node has no popover; it is edited and deleted from the inspector", () => {
  renderNode("component", { label: "Site", kind: "webClient" });
  expect(screen.queryByRole("region")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

const Sphere = nodeTypes.sphere as ComponentType<{ id: string; data: object; selected: boolean; width?: number }>;
const circle = () => document.querySelector(".rounded-full") as HTMLElement;

test("a resized sphere is drawn at its saved size", () => {
  renderNode("sphere", { label: "", diameter: 200 });
  expect(circle().style.width).toBe("200px");
  expect(circle().style.height).toBe("200px");
});

test("a sphere follows React Flow's size as soon as a resize starts, not only once it is saved", () => {
  render(<Sphere id="n1" data={{ label: "" }} selected width={180} />);
  expect(circle().style.width).toBe("112px");
  fireEvent.pointerDown(screen.getByTestId("resizer"));
  expect(circle().style.width).toBe("180px");
});

test("a sphere is never smaller than its label needs, saved or while resizing", () => {
  render(<Sphere id="n1" data={{ label: "", diameter: 40 }} selected />);
  expect(circle().style.width).toBe("112px");
  expect(screen.getByTestId("resizer").dataset.minWidth).toBe("112");
});

test("shapes can be resized; text and components cannot", () => {
  for (const [type, data] of [
    ["rectangle", { label: "" }],
    ["sphere", { label: "" }],
  ] as const) {
    const NodeComponent = nodeTypes[type] as ComponentType<{ id: string; data: object; selected: boolean }>;
    const { unmount } = render(<NodeComponent id="n1" data={data} selected />);
    screen.getByTestId("resizer");
    unmount();
  }
  for (const [type, data] of [
    ["text", { label: "Note" }],
    ["component", { label: "LB", kind: "loadBalancer" }],
  ] as const) {
    const NodeComponent = nodeTypes[type] as ComponentType<{ id: string; data: object; selected: boolean }>;
    const { unmount } = render(<NodeComponent id="n1" data={data} selected />);
    expect(screen.queryByTestId("resizer")).toBeNull();
    unmount();
  }
});

test("a component node shows its description, which can be edited in place", () => {
  seed([component("n1", "Payments API", "service", { description: "Takes payments." })]);
  const { container } = renderNode("component", {
    label: "Payments API",
    kind: "service",
    description: "Takes payments.",
  });
  fireEvent.doubleClick(screen.getByText("Takes payments."));
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Takes refunds." } });
  expect(diagram().objects[0]).toMatchObject({ description: "Takes refunds." });
  expect(container.textContent).toContain("Payments API");
});

test("a component node shows a chosen icon instead of its kind's", () => {
  const { container: chosen } = renderNode("component", { label: "API", kind: "service", icon: "CreditCard" });
  const { container: plain } = renderNode("component", { label: "API", kind: "service" });
  expect(chosen.querySelector("svg")?.getAttribute("class")).toContain("credit-card");
  expect(plain.querySelector("svg")?.getAttribute("class")).not.toContain("credit-card");
});

test("a bare rectangle is a centred label; with an icon, description or tags it is laid out like a component", () => {
  const { container: bare } = renderNode("rectangle", { label: "Zone" });
  expect(bare.querySelector(".rounded-lg.bg-accent\\/10")).toBeNull();

  const { container: card } = renderNode("rectangle", {
    label: "Stripe",
    icon: "Wallet",
    description: "Card payments.",
    tags: ["external"],
  });
  expect(card.querySelector(".rounded-lg.bg-accent\\/10 svg")).not.toBeNull();
  within(card).getByText("Card payments.");
  within(card).getByRole("list", { name: "Tags" });
});

test("a sphere shows its icon in a tile and its description", () => {
  const { container } = renderNode("sphere", { label: "Fraud", icon: "Shield", description: "Scores risk." });
  expect(container.querySelector(".rounded-lg.bg-accent\\/10 svg")).not.toBeNull();
  within(container).getByText("Scores risk.");
});

test("each detail on a node has an (i) that explains it, and the chosen value, on hover", () => {
  renderNode("component", { label: "LB", kind: "loadBalancer", options: { layer: "Layer 7", healthChecks: false } });
  expect(screen.queryByRole("tooltip")).toBeNull();

  fireEvent.pointerEnter(screen.getByRole("img", { name: "About Layer" }));
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.textContent).toContain("How much of each request it can see");
  expect(tooltip.textContent).toContain("Layer 7: Routes by what is in the request");

  fireEvent.pointerLeave(screen.getByRole("img", { name: "About Layer" }));
  expect(screen.queryByRole("tooltip")).toBeNull();

  fireEvent.pointerEnter(screen.getByRole("img", { name: "About Health checks" }));
  expect(screen.getByRole("tooltip").textContent).toContain("Stops sending traffic to servers that fail checks.");
});

test("a database lists what its structure holds", () => {
  renderNode("component", {
    label: "Orders",
    kind: "database",
    structure: { model: "Relational", tables: [{ name: "orders", columns: [{ name: "id" }, { name: "total" }] }] },
  });
  expect(screen.getByRole("list", { name: "Structure" }).textContent).toBe("orders id, total");
});

test("an icon named after a built-in property is no icon at all", () => {
  expect(iconFor("constructor", Star)).toBe(Star);
  expect(iconFor("toString", Star)).toBe(Star);
  expect(iconFor("Heart", Star)).not.toBe(Star);
});
