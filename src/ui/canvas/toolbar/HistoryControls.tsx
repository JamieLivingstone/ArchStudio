import { Network, Redo2, Undo2 } from "lucide-react";
import { IconButton } from "../../components/IconButton";
import { redo, undo, useAppState } from "../../state";
import { hasCommandKey, inDialog, isTyping, useKeyDown } from "../../useKeyDown";
import { useFormat } from "../hooks/useFormat";

export function HistoryControls() {
  const toUndo = useAppState((state) => state.undoSteps[state.undoSteps.length - 1]?.label);
  const toRedo = useAppState((state) => state.redoSteps[state.redoSteps.length - 1]?.label);
  const nothingToFormat = useAppState((state) => state.diagram.objects.every((object) => object.type === "text"));
  const format = useFormat();

  useKeyDown((event) => {
    if (isTyping(event) || inDialog()) return;
    // Shift+Alt+F, as in code editors. `code` because Alt changes the character typed on a Mac.
    if (event.shiftKey && event.altKey && event.code === "KeyF") {
      event.preventDefault();
      void format();
      return;
    }
    if (!hasCommandKey(event) || event.key.toLowerCase() !== "z") return;
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  });

  return (
    <div className="floating flex gap-0.5 rounded-xl p-1.5">
      <IconButton
        label="Undo"
        description={toUndo ? `${toUndo} (Cmd/Ctrl+Z)` : "Cmd/Ctrl+Z"}
        icon={Undo2}
        tooltip="top-start"
        disabled={!toUndo}
        onClick={undo}
      />
      <IconButton
        label="Redo"
        description={toRedo ? `${toRedo} (Shift+Cmd/Ctrl+Z)` : "Shift+Cmd/Ctrl+Z"}
        icon={Redo2}
        tooltip="top-start"
        disabled={!toRedo}
        onClick={redo}
      />
      <span aria-hidden="true" className="mx-0.5 w-px self-stretch bg-line" />
      <IconButton
        label="Format"
        description="Arrange everything neatly (Shift+Alt+F)"
        icon={Network}
        tooltip="top-start"
        disabled={nothingToFormat}
        onClick={() => void format()}
      />
    </div>
  );
}
