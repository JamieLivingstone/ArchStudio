import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";

export function setWindowTheme(theme: "light" | "dark" | null) {
  if (!isTauri()) return;
  getCurrentWindow()
    .setTheme(theme)
    .catch((error: unknown) => console.error("Could not set the window theme", error));
}

export function interceptWindowClose(shouldAsk: () => boolean, ask: () => void): () => void {
  if (!isTauri()) return () => {};
  const listening = getCurrentWindow().onCloseRequested((event) => {
    if (!shouldAsk()) return;
    event.preventDefault();
    ask();
  });
  return () => {
    listening.then((stop) => stop());
  };
}

// `destroy` rather than `close`, which would only ask again.
export const closeWindow = () => getCurrentWindow().destroy();

export function openLink(url: string) {
  openUrl(url).catch((error: unknown) => console.error("Could not open the link", error));
}
