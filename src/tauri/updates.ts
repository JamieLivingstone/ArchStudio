import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export interface AvailableUpdate {
  version: string;
  install: () => Promise<void>;
}

export async function findUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauri()) return null;
  const update = await check();
  return (
    update && {
      version: update.version,
      async install() {
        await update.downloadAndInstall();
        await relaunch();
      },
    }
  );
}
