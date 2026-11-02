import type { LanguageModel } from "ai";

export interface ModelDefinition {
  id: string;
  label: string;
}

export interface ProviderAccess {
  fetch: typeof fetch;
  apiKey?: string;
}

export interface ModelProvider {
  id: string;
  label: string;
  keysUrl: string;
  keyPrefix: string;
  models: ModelDefinition[];
  testModel: string;
  languageModel(modelId: string, access: ProviderAccess): LanguageModel;
}

// Stands in for a key the `fetch` will add, as the SDKs refuse to be built without one.
export const KEY_ADDED_BY_FETCH = "added-by-fetch";
