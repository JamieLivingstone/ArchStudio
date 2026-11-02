import { createAnthropic } from "@ai-sdk/anthropic";
import { KEY_ADDED_BY_FETCH, type ModelProvider } from "./modelProvider";

export const anthropic: ModelProvider = {
  id: "anthropic",
  label: "Anthropic",
  keysUrl: "https://console.anthropic.com/settings/keys",
  keyPrefix: "sk-ant-",
  testModel: "claude-haiku-5-5",
  models: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  ],
  languageModel: (modelId, { fetch, apiKey }) =>
    createAnthropic({
      fetch,
      apiKey: apiKey ?? KEY_ADDED_BY_FETCH,
      headers: apiKey ? { "anthropic-dangerous-direct-browser-access": "true" } : undefined,
    })(modelId),
};
