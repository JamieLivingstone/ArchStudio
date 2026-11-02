import { useLayoutEffect, useState } from "react";
import { setWindowTheme } from "../../tauri/window";

export type Theme = "system" | "light" | "dark";

const storageKey = "archstudio.theme";

function storedTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function storeTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, theme);
  } catch {
    // The choice still lasts until the app closes.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(storedTheme);

  // Before the first paint, so a saved theme does not flash the system one.
  useLayoutEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    setWindowTheme(theme === "system" ? null : theme);
  }, [theme]);

  function chooseTheme(next: Theme) {
    storeTheme(next);
    setTheme(next);
  }

  return [theme, chooseTheme] as const;
}
