import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { Reply } from "../Reply";

test("shows lists as lists, nested ones inside their parent", () => {
  render(<Reply text={"- Cache\n  - Redis\n- Queue"} />);
  const [outer, inner] = screen.getAllByRole("list");
  expect(within(outer).getAllByRole("listitem")).toHaveLength(3);
  expect(outer.contains(inner)).toBe(true);
  expect(within(inner).getByRole("listitem").textContent).toBe("Redis");
});

test("keeps the number a numbered list starts at", () => {
  render(<Reply text={"3. Third"} />);
  expect(screen.getByRole("list").getAttribute("start")).toBe("3");
});

test("shows bold, code and headings", () => {
  render(<Reply text={"# Summary\n\n**Cache** uses `SET`"} />);
  expect(screen.getByText("Summary").tagName).toBe("P");
  expect(screen.getByText("Cache").tagName).toBe("STRONG");
  expect(screen.getByText("SET").tagName).toBe("CODE");
});

test("a link keeps its words but goes nowhere", () => {
  render(<Reply text="[Open this](https://example.com)" />);
  screen.getByText("Open this");
  expect(screen.queryByRole("link")).toBeNull();
});

test("an image is not fetched", () => {
  render(<Reply text="![chart](https://example.com/x.png)" />);
  expect(screen.queryByRole("img")).toBeNull();
});

test("raw HTML is not rendered", () => {
  const { container } = render(<Reply text={'<img src="https://example.com/x.png" onerror="alert(1)">'} />);
  expect(container.querySelector("img")).toBeNull();
});

test("text still being streamed shows without error", () => {
  render(<Reply text={"- **Cache"} />);
  screen.getByRole("listitem");
});
