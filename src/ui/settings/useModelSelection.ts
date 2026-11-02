import { useEffect, useState } from "react";
import { type ModelDefinition, type ModelProvider, type ProviderAccess, providers } from "../../providers";
import { isDesktop } from "../../tauri/providers";
import { browserKeys } from "./browserKeys";
import { desktopKeys } from "./desktopKeys";

interface SelectedModel extends ModelDefinition {
  providerId: string;
}

export interface ModelSelection {
  connected: string[];
  connectedProviders: ModelProvider[];
  model: SelectedModel | undefined;
  connect: (providerId: string, value: string, signal?: AbortSignal) => Promise<void>;
  disconnect: (providerId: string) => Promise<void>;
  setModel: (providerId: string, modelId: string) => void;
  access: (providerId: string) => ProviderAccess | undefined;
}

export function useModelSelection(): ModelSelection {
  const keys = isDesktop() ? desktopKeys : browserKeys;
  const [connected, setConnected] = useState<string[]>([]);
  const [chosen, setChosen] = useState({ providerId: "", modelId: "" });

  useEffect(() => {
    keys
      .saved()
      .then((ids) => setConnected((current) => [...new Set([...current, ...ids])]))
      .catch((error: unknown) => console.error("Could not read which API keys are saved", error));
  }, [keys]);

  const connectedProviders = providers.filter((provider) => connected.includes(provider.id));
  const available = connectedProviders.flatMap((provider) =>
    provider.models.map((model): SelectedModel => ({ ...model, providerId: provider.id })),
  );
  const model =
    available.find((option) => option.providerId === chosen.providerId && option.id === chosen.modelId) ?? available[0];

  return {
    connected,
    connectedProviders,
    model,
    async connect(providerId, value, signal) {
      const provider = providers.find(({ id }) => id === providerId);
      if (!provider) return;
      await keys.tryAndSave(provider, value.trim(), signal);
      setConnected((current) => [...new Set([...current, providerId])]);
    },
    async disconnect(providerId) {
      await keys.remove(providerId);
      setConnected((current) => current.filter((id) => id !== providerId));
    },
    setModel: (providerId, modelId) => setChosen({ providerId, modelId }),
    access: (providerId) => (connected.includes(providerId) ? keys.access(providerId) : undefined),
  };
}
