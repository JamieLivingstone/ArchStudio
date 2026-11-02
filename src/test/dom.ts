import { screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ModelSelection } from "../ui/settings/useModelSelection";

export const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

export const modelSelection = (changes: Partial<ModelSelection> = {}): ModelSelection => ({
  connected: [],
  connectedProviders: [],
  model: undefined,
  connect: vi.fn(),
  disconnect: vi.fn(),
  setModel: vi.fn(),
  access: vi.fn(),
  ...changes,
});
