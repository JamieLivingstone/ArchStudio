import { type ModelProvider, type ProviderAccess, providers, testConnection } from "../../providers";

const storageKey = (providerId: string) => `archstudio.apiKey.${providerId}`;

const inMemory: Record<string, string | undefined> = {};

function storedKey(providerId: string) {
  try {
    return sessionStorage.getItem(storageKey(providerId)) ?? inMemory[providerId];
  } catch {
    return inMemory[providerId];
  }
}

function storeKey(providerId: string, key?: string) {
  inMemory[providerId] = key;
  try {
    if (key) sessionStorage.setItem(storageKey(providerId), key);
    else sessionStorage.removeItem(storageKey(providerId));
  } catch {
    // Held in memory instead.
  }
}

const access = (providerId: string): ProviderAccess => ({
  fetch: (input, init) => fetch(input, init),
  apiKey: storedKey(providerId),
});

export const browserKeys = {
  saved: async () => providers.map(({ id }) => id).filter(storedKey),
  access,
  async tryAndSave(provider: ModelProvider, key: string, signal?: AbortSignal) {
    await testConnection(provider, { ...access(provider.id), apiKey: key }, signal);
    signal?.throwIfAborted();
    storeKey(provider.id, key);
  },
  remove: async (providerId: string) => storeKey(providerId),
};
