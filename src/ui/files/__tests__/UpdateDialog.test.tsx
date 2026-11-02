import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { button } from "../../../test/dom";
import { UpdateDialog } from "../UpdateDialog";

function setup({ installing = false, error = "" } = {}) {
  const onInstall = vi.fn();
  const onLater = vi.fn();
  render(
    <UpdateDialog version="0.2.0" installing={installing} error={error} onInstall={onInstall} onLater={onLater} />,
  );
  return { onInstall, onLater };
}

test("names the version and installs or waits", async () => {
  const { onInstall, onLater } = setup();
  screen.getByText("ArchStudio 0.2.0 is available", { ignore: false });
  await userEvent.click(button("Install and restart"));
  expect(onInstall).toHaveBeenCalledTimes(1);
  await userEvent.click(button("Later"));
  expect(onLater).toHaveBeenCalledTimes(1);
});

test("cannot be pressed again or put off while installing", () => {
  setup({ installing: true });
  expect(button("Installing…").disabled).toBe(true);
  expect(button("Later").disabled).toBe(true);
});

test("says why an update failed", () => {
  setup({ error: "Could not install the update." });
  expect(screen.getByRole("alert").textContent).toBe("Could not install the update.");
});
