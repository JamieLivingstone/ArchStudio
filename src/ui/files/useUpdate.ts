import { useEffect, useState } from "react";
import { type AvailableUpdate, findUpdate } from "../../tauri/updates";
import { reason } from "../errorReason";

export function useUpdate() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Being offline is not worth interrupting anyone for.
    findUpdate()
      .then(setUpdate)
      .catch((cause: unknown) => console.error("Could not check for updates", cause));
  }, []);

  async function install() {
    setInstalling(true);
    setError("");
    try {
      await update?.install();
    } catch (cause) {
      setError(`Could not install the update. ${reason(cause)}`);
      setInstalling(false);
    }
  }

  return { version: update?.version, installing, error, install, dismiss: () => setUpdate(null) };
}
