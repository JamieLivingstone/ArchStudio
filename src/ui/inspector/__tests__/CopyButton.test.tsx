import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { CopyButton } from "../CopyButton";

const writeText = vi.fn(async (_text: string) => {});
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

afterEach(() => {
  vi.useRealTimers();
  writeText.mockClear();
});

test("copies the text as written and says so", async () => {
  render(<CopyButton text="**Cache**" />);
  fireEvent.click(button("Copy message"));
  await screen.findByRole("button", { name: "Copied" });
  expect(writeText).toHaveBeenCalledWith("**Cache**");
});

test("says so when the copy fails", async () => {
  writeText.mockRejectedValueOnce(new Error("Denied"));
  render(<CopyButton text="Cache" />);
  fireEvent.click(button("Copy message"));
  await screen.findByRole("button", { name: "Could not copy" });
});

test("goes back to offering a copy", async () => {
  vi.useFakeTimers();
  render(<CopyButton text="Cache" />);
  fireEvent.click(button("Copy message"));
  await act(() => vi.advanceTimersByTimeAsync(0));
  button("Copied");
  await act(() => vi.advanceTimersByTimeAsync(2000));
  button("Copy message");
});
