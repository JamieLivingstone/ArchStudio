import { createOpenAI } from "@ai-sdk/openai";
import { KEY_ADDED_BY_FETCH, type ModelProvider } from "./modelProvider";

export const openai: ModelProvider = {
  id: "openai",
  label: "OpenAI",
  keysUrl: "https://platform.openai.com/api-keys",
  keyPrefix: "sk-",
  testModel: "gpt-6-luna",
  models: [
    { id: "gpt-6-astra", label: "GPT-6 Astra" },
    { id: "gpt-6-luna", label: "GPT-6 Luna" },
  ],
  languageModel: (modelId, { fetch, apiKey }) => createOpenAI({ fetch, apiKey: apiKey ?? KEY_ADDED_BY_FETCH })(modelId),
};
