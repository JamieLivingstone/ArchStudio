import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { applyOperations } from "../../diagram/apply";
import { proposalRows } from "../proposal";
import { acceptProposal, arrangeProposal, getAppState, pendingProposal, rejectProposal, useAppState } from "../state";
import { useFitDiagram } from "./hooks/useFitDiagram";
import { arrange } from "./hooks/useFormat";

const FOCUS_ZOOM = 1.25;
const button = "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors";

function useArrangedProposal() {
  const proposal = useAppState(pendingProposal);
  const waiting = proposal !== undefined && !proposal.arranged;
  const measured = useStore(
    ({ nodeLookup }) =>
      waiting && proposal.preview.objects.every(({ id }) => nodeLookup.get(id)?.measured.height !== undefined),
  );
  const { getNode } = useReactFlow();
  const fitDiagram = useFitDiagram();

  const fitTimer = useRef<number | undefined>(undefined);
  const fitSoon = useCallback(() => {
    window.clearTimeout(fitTimer.current);
    fitTimer.current = window.setTimeout(() => void fitDiagram(), 150);
  }, [fitDiagram]);
  useEffect(() => () => window.clearTimeout(fitTimer.current), []);

  useEffect(() => {
    if (!measured || !proposal) return;
    let replaced = false;
    arrange(applyOperations(proposal.base, proposal.operations), getNode)
      .catch((error: unknown) => console.error("Could not arrange the proposal", error))
      .then((arranged) => {
        if (replaced) return;
        arrangeProposal(arranged?.positions, arranged?.sizes);
        fitSoon();
      });
    return () => {
      replaced = true;
    };
  }, [measured, proposal, getNode, fitSoon]);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(arrangeProposal, 3000);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const pending = proposal !== undefined;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) fitSoon();
    wasPending.current = pending;
  }, [pending, fitSoon]);
}

function useFocusedChange() {
  const focus = useAppState((state) => (state.focusOnCanvas ? undefined : state.focus));
  const { getNodesBounds } = useReactFlow();
  const fitDiagram = useFitDiagram();

  useEffect(() => {
    if (!focus) return;
    const { connections } = pendingProposal(getAppState())?.preview ?? getAppState().diagram;
    const connection = connections.find((candidate) => candidate.id === focus);
    const ids = connection ? [connection.from, connection.to] : [focus];
    if (getNodesBounds(ids).width === 0) return;
    void fitDiagram({ ids, maxZoom: FOCUS_ZOOM });
  }, [focus, fitDiagram, getNodesBounds]);
}

export function ProposalReview() {
  useArrangedProposal();
  useFocusedChange();
  const proposal = useAppState(pendingProposal);
  if (!proposal) return null;
  const rows = proposalRows(proposal);
  const count = rows.filter((row) => row.status === "pending").length;
  const rest = count < rows.length ? "the rest" : "all";

  return (
    <Panel position="bottom-center" className="nopan floating flex select-none items-center gap-1.5 rounded-xl p-1.5">
      <p className="px-2 text-xs text-muted">
        <span className="font-medium text-fg">Proposed change</span> · {count} to decide
      </p>
      <button
        type="button"
        onClick={() => rejectProposal()}
        className={`${button} text-fg hover:bg-red-500/10 hover:text-red-500`}
      >
        <X size={14} />
        Reject {rest}
      </button>
      <button
        type="button"
        onClick={() => acceptProposal()}
        className={`${button} bg-accent text-surface hover:opacity-90`}
      >
        <Check size={14} />
        Accept {rest}
      </button>
    </Panel>
  );
}
