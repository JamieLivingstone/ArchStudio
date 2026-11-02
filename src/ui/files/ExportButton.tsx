import { Download } from "lucide-react";
import { useState } from "react";
import { renderImage } from "../canvas/exportImage";
import { reason } from "../errorReason";
import { getAppState, pendingProposal, useAppState } from "../state";
import { saveImage } from "./saveImage";

interface ExportButtonProps {
  className: string;
  onError: (message: string) => void;
}

export function ExportButton({ className, onError }: ExportButtonProps) {
  const nothingToExport = useAppState((state) => state.diagram.objects.length === 0);
  const previewing = useAppState((state) => pendingProposal(state) !== undefined);
  const [exporting, setExporting] = useState(false);

  async function exportImage() {
    onError("");
    setExporting(true);
    try {
      const name = (getAppState().file?.name ?? "Untitled").replace(/\.json$/i, "");
      await saveImage(await renderImage(), `${name}.png`);
    } catch (cause) {
      onError(`Could not export. ${reason(cause)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={nothingToExport || previewing || exporting}
      onClick={exportImage}
      className={className}
    >
      <Download size={14} strokeWidth={1.75} />
      Export PNG
    </button>
  );
}
