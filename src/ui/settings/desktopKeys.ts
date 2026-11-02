import { type ModelProvider, type ProviderAccess, testConnection } from "../../providers";
import { deleteApiKey, discardApiKey, holdApiKey, nativeFetch, saveApiKey, storedApiKeys } from "../../tauri/providers";

// The native layer holds one key at a time while it is tried, so attempts take turns.
let attempts: Promise<unknown> = Promise.resolve();

const access = (providerId: string): ProviderAccess => ({ fetch: nativeFetch(providerId) });

async function tryAndSave(provider: ModelProvider, key: string, signal?: AbortSignal) {
  await holdApiKey(provider.id, key);
  try {
    await testConnection(provider, access(provider.id), signal);
    signal?.throwIfAborted();
    await saveApiKey(provider.id);
  } catch (error) {
    await discardApiKey(provider.id);
    throw error;
  }
}

export const desktopKeys = {
  saved: () => storedApiKeys(),
  access,
  tryAndSave(provider: ModelProvider, key: string, signal?: AbortSignal) {
    const attempt = attempts.then(() => tryAndSave(provider, key, signal));
    attempts = attempt.catch(() => {});
    return attempt;
  },
  remove: (providerId: string) => deleteApiKey(providerId),
};
