import { getAppState, nudgeSelected, pendingProposal, selectAll } from "../../state";
import { hasCommandKey, inDialog, isTyping, useKeyDown } from "../../useKeyDown";
import type { CanvasTool } from "../toolbar/Sidebar";
import { useClipboard } from "./useClipboard";

const arrows: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function useCanvasShortcuts(setTool: (tool: CanvasTool) => void) {
  const { copy, cut, paste } = useClipboard();

  useKeyDown((event) => {
    if (isTyping(event) || inDialog()) return;
    const arrow = arrows[event.key];
    const previewing = pendingProposal(getAppState()) !== undefined;
    if (previewing && (arrow || (hasCommandKey(event) && "axv".includes(event.key.toLowerCase())))) return;
    if (arrow && !hasCommandKey(event) && getAppState().selection.length > 0) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      nudgeSelected(arrow[0] * step, arrow[1] * step);
      return;
    }
    const key = event.key.toLowerCase();
    if (hasCommandKey(event)) {
      if (key === "a") {
        event.preventDefault();
        selectAll();
      } else if ((key === "c" && copy()) || (key === "x" && cut()) || (key === "v" && paste())) {
        event.preventDefault();
      }
    } else if (!event.altKey) {
      if (key === "v") setTool("select");
      if (key === "h") setTool("move");
    }
  });
}
