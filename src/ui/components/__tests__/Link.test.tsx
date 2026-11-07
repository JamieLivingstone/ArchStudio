import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { isDesktop } from "../../../tauri/providers";
import { openLink } from "../../../tauri/window";
import { Link } from "../Link";

vi.mock("../../../tauri/providers", () => ({ isDesktop: vi.fn(() => false) }));
vi.mock("../../../tauri/window", () => ({ openLink: vi.fn() }));

afterEach(() => vi.clearAllMocks());

const url = "https://example.com/";

test("is a link that opens in a new tab", async () => {
  render(<Link href={url}>Docs</Link>);
  const link = screen.getByRole("link", { name: "Docs" });
  expect(link.getAttribute("href")).toBe(url);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  await userEvent.click(link);
  expect(openLink).not.toHaveBeenCalled();
});

test("in the desktop app, opens in the system browser", async () => {
  vi.mocked(isDesktop).mockReturnValue(true);
  render(<Link href={url}>Docs</Link>);
  await userEvent.click(screen.getByRole("link", { name: "Docs" }));
  expect(openLink).toHaveBeenCalledWith(url);
});
