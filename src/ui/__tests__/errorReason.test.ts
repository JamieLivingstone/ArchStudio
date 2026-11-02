import { expect, test } from "vitest";
import { reason } from "../errorReason";

test("gives an error's message, or the thing itself when it is not an error", () => {
  expect(reason(new Error("Disk full"))).toBe("Disk full");
  expect(reason("The keychain is locked.")).toBe("The keychain is locked.");
});
