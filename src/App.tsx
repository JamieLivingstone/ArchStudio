import { useCallback, useEffect, useState } from "react";
import { parseDiagram } from "./diagram/parse";
import type { Diagram } from "./diagram/schema";
import { Canvas } from "./ui/canvas/Canvas";
import { preloadLayout } from "./ui/canvas/layout/format";
import { reason } from "./ui/errorReason";
import { UnsavedDialog } from "./ui/files/UnsavedDialog";
import { UpdateDialog } from "./ui/files/UpdateDialog";
import { useFileDrop } from "./ui/files/useFileDrop";
import { useSave } from "./ui/files/useSave";
import { useUnsavedGuard } from "./ui/files/useUnsavedGuard";
import { useUpdate } from "./ui/files/useUpdate";
import { Header } from "./ui/Header";
import { Landing } from "./ui/landing/Landing";
import { SettingsDialog } from "./ui/settings/SettingsDialog";
import { useModelSelection } from "./ui/settings/useModelSelection";
import { useTheme } from "./ui/settings/useTheme";
import { type DiagramFile, endEdit, loadDiagram, useAppState } from "./ui/state";
import { hasCommandKey, useKeyDown } from "./ui/useKeyDown";

export function App() {
  const modelSelection = useModelSelection();
  const [theme, setTheme] = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [landingOpen, setLandingOpen] = useState(true);
  const [loaded, setLoaded] = useState({ count: 0, arrange: false });
  const [opening, setOpening] = useState(false);
  const [fileError, setFileError] = useState("");
  const closeLanding = useCallback(() => {
    setOpening(false);
    setLandingOpen(false);
    setFileError("");
  }, []);
  const fileName = useAppState((state) => state.file?.name);
  const { save, saveError, clearSaveError } = useSave();
  const unsavedGuard = useUnsavedGuard(save);
  const update = useUpdate();

  function start(diagram: Diagram, { file, arrange = false }: { file?: DiagramFile; arrange?: boolean } = {}) {
    unsavedGuard.askFirst(() => {
      loadDiagram(diagram, file);
      clearSaveError();
      setFileError("");
      setLoaded(({ count }) => ({ count: count + 1, arrange }));
      if (arrange) setOpening(true);
      else setLandingOpen(false);
    });
  }

  function openFile(text: string, file: DiagramFile) {
    const result = parseDiagram(text);
    if ("error" in result) setFileError(`Could not open ${file.name}. ${result.error}`);
    else start(result.diagram, { file });
  }

  const openFailed = (cause: unknown) => setFileError(`Could not open the file. ${reason(cause)}`);

  useFileDrop(openFile, openFailed);

  useEffect(preloadLayout, []);

  useEffect(() => {
    document.addEventListener("focusout", endEdit);
    return () => document.removeEventListener("focusout", endEdit);
  }, []);

  useKeyDown((event) => {
    if (!hasCommandKey(event)) return;
    if (event.key === ",") {
      event.preventDefault();
      setSettingsOpen(true);
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  });

  return (
    <div className="flex h-full flex-col">
      <Header
        error={saveError || (landingOpen ? "" : fileError)}
        onError={setFileError}
        onSave={save}
        onHome={() => setLandingOpen(true)}
      />
      <main className="min-h-0 flex-1">
        <Canvas
          key={loaded.count}
          arrangeOnLoad={loaded.arrange}
          onArranged={closeLanding}
          theme={theme}
          modelSelection={modelSelection}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </main>
      {landingOpen && (
        <Landing
          opening={opening}
          error={fileError}
          onStart={start}
          onOpenFile={openFile}
          onOpenFailed={openFailed}
          onClose={closeLanding}
        />
      )}
      {update.version && (
        <UpdateDialog
          version={update.version}
          installing={update.installing}
          error={update.error}
          onInstall={() => unsavedGuard.askFirst(update.install)}
          onLater={update.dismiss}
        />
      )}
      {unsavedGuard.asking && (
        <UnsavedDialog
          fileName={fileName ?? "Untitled"}
          onSave={unsavedGuard.save}
          onDiscard={unsavedGuard.discard}
          onCancel={unsavedGuard.cancel}
        />
      )}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        modelSelection={modelSelection}
      />
    </div>
  );
}
