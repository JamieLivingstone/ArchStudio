import { Background, ConnectionMode, type EdgeTypes, Panel, ReactFlow, SelectionMode, useStore } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { sideSchema } from "../../diagram/schema";
import { Inspector } from "../inspector/Inspector";
import type { ModelSelection } from "../settings/useModelSelection";
import type { Theme } from "../settings/useTheme";
import {
  canConnect,
  connect,
  focusOn,
  getAppState,
  pendingProposal,
  remove,
  startFromArranged,
  useAppState,
} from "../state";
import { AlignmentGuides } from "./AlignmentGuides";
import { ConnectionEdge } from "./edges/ConnectionEdge";
import { useCanvasNodes } from "./hooks/useCanvasNodes";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useFormat } from "./hooks/useFormat";
import { nodeTypes } from "./nodes/nodeTypes";
import { ProposalReview } from "./ProposalReview";
import { HistoryControls } from "./toolbar/HistoryControls";
import { type CanvasTool, Sidebar } from "./toolbar/Sidebar";
import { fitOptions, ViewControls } from "./toolbar/ViewControls";

const edgeTypes: EdgeTypes = { connection: ConnectionEdge };

interface CanvasProps {
  theme: Theme;
  modelSelection: ModelSelection;
  onOpenSettings: () => void;
  arrangeOnLoad?: boolean;
  onArranged?: () => void;
}

// Node sizes differ a little between webviews, so a template is laid out where it is drawn rather than
// trusting saved positions. Loading the result again makes it the starting point: nothing to undo or save.
function ArrangeOnLoad({ onDone }: { onDone: () => void }) {
  const measured = useStore(
    ({ nodeLookup }) =>
      nodeLookup.size > 0 && [...nodeLookup.values()].every((node) => node.measured.height !== undefined),
  );
  const format = useFormat();
  const done = useRef(false);

  useEffect(() => {
    if (!measured || done.current) return;
    done.current = true;
    const { documentId, diagram } = getAppState();
    format({ animate: false }).then(() => {
      if (getAppState().documentId === documentId) startFromArranged(diagram);
      onDone();
    });
  }, [measured, format, onDone]);

  useEffect(() => {
    const timer = window.setTimeout(onDone, 3000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return null;
}

export function Canvas({ theme, modelSelection, onOpenSettings, arrangeOnLoad = false, onArranged }: CanvasProps) {
  const [tool, setTool] = useState<CanvasTool>("move");
  const [arranging, setArranging] = useState(arrangeOnLoad);
  const arranged = useCallback(() => setArranging(false), []);
  useEffect(() => {
    if (arrangeOnLoad && !arranging) onArranged?.();
  }, [arrangeOnLoad, arranging, onArranged]);
  const { nodes, edges, guides, onNodesChange, onEdgesChange } = useCanvasNodes();
  const previewing = useAppState((state) => pendingProposal(state) !== undefined);
  const arrangingProposal = useAppState((state) => {
    const proposal = pendingProposal(state);
    return proposal !== undefined && !proposal.layout;
  });
  useCanvasShortcuts(setTool);

  return (
    <ReactFlow
      className={arranging ? "arranging" : arrangingProposal ? "arranging-proposal" : undefined}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      connectionMode={ConnectionMode.Loose}
      onConnect={({ source, target, sourceHandle, targetHandle }) =>
        connect(source, target, sideSchema.safeParse(sourceHandle).data, sideSchema.safeParse(targetHandle).data)
      }
      isValidConnection={({ source, target }) => canConnect(source, target)}
      // Deleting goes through the state; React Flow deletes nothing itself.
      onBeforeDelete={async ({ nodes: deletedNodes, edges: deletedEdges }) => {
        if (previewing) return false;
        remove([...deletedNodes, ...deletedEdges].map((item) => item.id));
        return false;
      }}
      nodeOrigin={[0, 0]}
      nodesDraggable={!previewing}
      nodesConnectable={!previewing}
      elementsSelectable={!previewing}
      onNodeMouseEnter={previewing ? (_, node) => focusOn(node.id, true) : undefined}
      onNodeMouseLeave={previewing ? () => focusOn(undefined) : undefined}
      onEdgeMouseEnter={previewing ? (_, edge) => focusOn(edge.id, true) : undefined}
      onEdgeMouseLeave={previewing ? () => focusOn(undefined) : undefined}
      fitView
      fitViewOptions={{ padding: fitOptions().padding, maxZoom: 1 }}
      minZoom={0.1}
      zoomOnDoubleClick={false}
      disableKeyboardA11y
      panOnDrag={tool === "move" ? true : [1, 2]}
      selectionOnDrag={tool === "select"}
      selectionMode={SelectionMode.Partial}
      connectionRadius={28}
      defaultMarkerColor="var(--xy-edge-stroke)"
      colorMode={theme}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      {arrangeOnLoad && <ArrangeOnLoad onDone={arranged} />}
      <ProposalReview />
      <AlignmentGuides guides={guides} />
      <Sidebar tool={tool} onToolChange={setTool} onOpenSettings={onOpenSettings} />
      <Inspector modelSelection={modelSelection} onOpenSettings={onOpenSettings} />
      <Panel position="bottom-left" className="nopan flex items-end gap-2">
        <HistoryControls />
        <ViewControls />
      </Panel>
    </ReactFlow>
  );
}
