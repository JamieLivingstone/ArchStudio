import { createStore, useStore } from "zustand";
import { applyOperations } from "../diagram/apply";
import type { BoundaryKind } from "../diagram/boundaryKinds";
import type { OptionValue } from "../diagram/componentKinds";
import type { DatabaseStructure } from "../diagram/databaseStructure";
import { ancestorsOf, descendantsOf } from "../diagram/hierarchy";
import { type DiagramOperation, diagramOperationSchema, placementOperations } from "../diagram/operations";
import {
  type Boundary,
  type Connection,
  type Diagram,
  type DiagramObject,
  emptyDiagram,
  type Position,
  type Side,
  type Size,
} from "../diagram/schema";
import { type Issue, validateOperation, validateOperations } from "../diagram/validate";
import { BOUNDARY_HEADER, BOUNDARY_MARGIN, estimatedSize } from "./canvas/nodes/sizes";
import { buildProposal, type Proposal, withLayout, withRejected, withReplaced } from "./proposal";

interface Step {
  label: string;
  diagram: Diagram;
  typingIn?: string;
}

export interface DiagramFile {
  name: string;
  path?: string;
}

export interface AppState {
  documentId: number;
  diagram: Diagram;
  savedDiagram: Diagram;
  file?: DiagramFile;
  selection: string[];
  undoSteps: Step[];
  redoSteps: Step[];
  proposal?: Proposal;
  focus?: string;
  focusOnCanvas?: boolean;
}

const UNDO_LIMIT = 200;

const initialDiagram = emptyDiagram();
const store = createStore<AppState>(() => ({
  documentId: 0,
  diagram: initialDiagram,
  savedDiagram: initialDiagram,
  selection: [],
  undoSteps: [],
  redoSteps: [],
}));

export const useAppState = <T>(choose: (state: AppState) => T): T => useStore(store, choose);
export const getAppState = store.getState;

const last = <T>(items: T[]): T | undefined => items[items.length - 1];

export const selectedObjects = ({ diagram, selection }: AppState) =>
  diagram.objects.filter((object) => selection.includes(object.id));

export const selectionInScope = (state: AppState) => {
  const selected = selectedObjects(state);
  const ids = new Set(
    selected.flatMap((object) => [object.id, ...descendantsOf(state.diagram, object.id).map(({ id }) => id)]),
  );
  return state.diagram.objects.filter((object) => ids.has(object.id));
};

export const selectedConnections = ({ diagram, selection }: AppState) =>
  diagram.connections.filter((connection) => selection.includes(connection.id));

export function change(label: string, operations: DiagramOperation[], typingIn?: string): boolean {
  const { diagram, undoSteps } = getAppState();
  // The shape the file format allows is checked too, or an edit could save what cannot be reopened.
  const malformed = operations.flatMap((operation) => diagramOperationSchema.safeParse(operation).error?.issues ?? []);
  const issues = malformed.length > 0 ? malformed : validateOperations(diagram, operations);
  if (operations.length === 0 || issues.length > 0) {
    if (issues.length > 0) console.error(`Could not ${label.toLowerCase()}`, issues);
    return false;
  }
  const stillTyping = typingIn !== undefined && last(undoSteps)?.typingIn === typingIn;
  store.setState({
    diagram: applyOperations(diagram, operations),
    undoSteps: stillTyping ? undoSteps : [...undoSteps, { label, diagram, typingIn }].slice(-UNDO_LIMIT),
    redoSteps: [],
  });
  return true;
}

export const pendingProposal = ({ proposal }: AppState) => (proposal?.operations.length ? proposal : undefined);

store.subscribe(({ diagram, proposal }) => {
  if (proposal && proposal.operations.length > 0 && proposal.base !== diagram) {
    const unarranged = { ...proposal, layout: proposal.layout && [] };
    store.setState({ proposal: { ...buildProposal(diagram, proposal.operations, unarranged), arranged: false } });
  }
});

export function propose(operations: DiagramOperation[]): Issue[] {
  const { diagram } = getAppState();
  const issues = validateOperations(diagram, operations);
  if (issues.length === 0) store.setState({ proposal: buildProposal(diagram, operations), focus: undefined });
  return issues;
}

export function dismissProposal() {
  store.setState({ proposal: undefined, focus: undefined });
}

export function acceptProposal(ids?: string[]): boolean {
  const proposal = pendingProposal(getAppState());
  if (!proposal) return false;
  const [chosen, rest] = ids ? withReplaced(proposal, ids) : [proposal.operations, []];
  store.setState({ proposal: undefined, focus: undefined });
  const accepted = chosen.length > 0 && change("Assistant edit", [...chosen, ...(proposal.layout ?? [])]);
  const left = accepted
    ? { ...buildProposal(getAppState().diagram, rest, { ...proposal, layout: [] }, "accepted"), arranged: false }
    : proposal;
  store.setState({ proposal: left });
  return accepted;
}

export function rejectProposal(ids?: string[]) {
  const proposal = pendingProposal(getAppState());
  if (proposal) store.setState({ proposal: withRejected(proposal, ids), focus: undefined });
}

export function focusOn(id: string | undefined, onCanvas = false) {
  store.setState({ focus: id, focusOnCanvas: onCanvas });
}

export function undo() {
  const { diagram, undoSteps, redoSteps } = getAppState();
  const step = last(undoSteps);
  if (!step) return;
  store.setState({
    diagram: step.diagram,
    undoSteps: undoSteps.slice(0, -1),
    redoSteps: [...redoSteps, { label: step.label, diagram }],
  });
}

export function redo() {
  const { diagram, undoSteps, redoSteps } = getAppState();
  const step = last(redoSteps);
  if (!step) return;
  store.setState({
    diagram: step.diagram,
    undoSteps: [...undoSteps, { label: step.label, diagram }],
    redoSteps: redoSteps.slice(0, -1),
  });
}

export function loadDiagram(diagram: Diagram, file?: DiagramFile) {
  store.setState({
    documentId: getAppState().documentId + 1,
    diagram,
    savedDiagram: diagram,
    file,
    selection: [],
    undoSteps: [],
    redoSteps: [],
    proposal: undefined,
    focus: undefined,
  });
}

const endTyping = (steps: Step[]) => steps.map(({ typingIn: _, ...step }) => step);

export function startFromArranged(from: Diagram) {
  const { diagram, undoSteps, redoSteps } = getAppState();
  const untouched =
    redoSteps.length === 0 && (diagram === from || (undoSteps.length === 1 && undoSteps[0].diagram === from));
  if (untouched) store.setState({ savedDiagram: diagram, undoSteps: [] });
}

export function endEdit() {
  const { undoSteps } = getAppState();
  if (undoSteps.some((step) => step.typingIn !== undefined)) store.setState({ undoSteps: endTyping(undoSteps) });
}

export function markSaved(diagram: Diagram, file: DiagramFile) {
  store.setState({ savedDiagram: diagram, file, undoSteps: endTyping(getAppState().undoSteps) });
}

export const hasUnsavedChanges = ({ diagram, savedDiagram }: AppState) => diagram !== savedDiagram;

export function select(ids: string[]) {
  store.setState({ selection: ids, undoSteps: endTyping(getAppState().undoSteps) });
}

export function selectAll() {
  select(getAppState().diagram.objects.map((object) => object.id));
}

export function addObject(object: DiagramObject, label: string, { keepSelection = false } = {}) {
  if (change(label, [{ type: "object.add", object }]) && !keepSelection) select([object.id]);
}

export function insertionTarget({ diagram, selection }: AppState): Boundary | undefined {
  if (selection.length !== 1) return undefined;
  const selected = diagram.objects.find((object) => object.id === selection[0]);
  const target =
    selected?.type === "boundary" ? selected : diagram.objects.find((object) => object.id === selected?.parent);
  return target?.type === "boundary" ? target : undefined;
}

export function setLabel(id: string, value: string) {
  const object = getAppState().diagram.objects.find((candidate) => candidate.id === id);
  if (object?.type === "component" || object?.type === "boundary") {
    change("Rename", [{ type: "object.update", id, changes: { name: value } }], id);
  } else if (object) {
    change("Edit text", [{ type: "object.update", id, changes: { text: value } }], id);
  }
}

export function setOptions(id: string, options: Record<string, OptionValue>, typingIn?: string) {
  const object = getAppState().diagram.objects.find((candidate) => candidate.id === id);
  const orphaned = object?.type === "component" && object.structure && object.structure.model !== options.model;
  change(
    "Change details",
    [{ type: "object.update", id, changes: orphaned ? { options, structure: null } : { options } }],
    typingIn,
  );
}

export function setStructure(id: string, structure: DatabaseStructure | null) {
  change("Edit data structure", [{ type: "object.update", id, changes: { structure } }], `${id} structure`);
}

export function setDescription(id: string, description: string) {
  change("Edit description", [{ type: "object.update", id, changes: { description } }], `${id} description`);
}

export function setIcon(id: string, icon: string | undefined) {
  change("Change icon", [{ type: "object.update", id, changes: { icon: icon ?? null } }]);
}

export function setTags(id: string, tags: string[]) {
  change("Edit tags", [{ type: "object.update", id, changes: { tags } }]);
}

export function resizeObject(id: string, size: Size, position: Position) {
  change("Resize", [{ type: "object.update", id, changes: { size, position } }]);
}

function withContents(diagram: Diagram, offsets: Map<string, Position>): Map<string, Position> {
  const positions = new Map<string, Position>();
  for (const [id, offset] of offsets) {
    const object = diagram.objects.find((candidate) => candidate.id === id);
    for (const moved of object ? [object, ...descendantsOf(diagram, id)] : []) {
      if (positions.has(moved.id)) continue;
      positions.set(moved.id, { x: moved.position.x + offset.x, y: moved.position.y + offset.y });
    }
  }
  return positions;
}

const moveOperations = (positions: Map<string, Position>, parents = new Map<string, string | null>()) =>
  [...positions].map(
    ([id, position]): DiagramOperation => ({
      type: "object.update",
      id,
      changes: parents.has(id) ? { position, parent: parents.get(id) } : { position },
    }),
  );

export function nudgeSelected(dx: number, dy: number) {
  const { diagram, selection } = getAppState();
  const objects = selectedObjects(getAppState());
  const offsets = new Map(objects.map(({ id }) => [id, { x: dx, y: dy }]));
  change("Move", moveOperations(withContents(diagram, offsets)), `nudge ${selection.join(" ")}`);
}

function applyLayoutAdjustment(operations: DiagramOperation[]) {
  const { diagram } = getAppState();
  if (operations.length === 0 || validateOperations(diagram, operations).length > 0) return;
  store.setState({ diagram: applyOperations(diagram, operations) });
}

export function makeRoomFor(positions: Map<string, Position>) {
  const { diagram } = getAppState();
  const offsets = new Map<string, Position>();
  for (const [id, position] of positions) {
    const object = diagram.objects.find((candidate) => candidate.id === id);
    if (object) offsets.set(id, { x: position.x - object.position.x, y: position.y - object.position.y });
  }
  applyLayoutAdjustment(moveOperations(withContents(diagram, offsets)));
}

export function fitBoundariesToContents(changes: Map<string, { position: Position; size?: Size }>) {
  applyLayoutAdjustment(
    [...changes].map(
      ([id, { position, size }]): DiagramOperation => ({
        type: "object.update",
        id,
        changes: size ? { position, size } : { position },
      }),
    ),
  );
}

export function formatLayout(positions: Map<string, Position>, sizes = new Map<string, Size>()) {
  change("Format layout", placementOperations(getAppState().diagram.objects, positions, sizes));
}

export function arrangeProposal(positions = new Map<string, Position>(), sizes = new Map<string, Size>()) {
  const proposal = pendingProposal(getAppState());
  if (proposal) store.setState({ proposal: withLayout(proposal, positions, sizes) });
}

export function moveObjects(moves: { id: string; position: Position; parent?: string | null }[]) {
  const { diagram } = getAppState();
  const offsets = new Map<string, Position>();
  const parents = new Map<string, string | null>();
  for (const { id, position, parent } of moves) {
    const object = diagram.objects.find((candidate) => candidate.id === id);
    if (!object) continue;
    offsets.set(id, { x: position.x - object.position.x, y: position.y - object.position.y });
    if (parent !== undefined && parent !== (object.parent ?? null)) parents.set(id, parent);
  }
  change("Move", moveOperations(withContents(diagram, offsets), parents));
}

export function groupObjects(
  boxes: { id: string; x: number; y: number; width: number; height: number }[],
  kind?: BoundaryKind,
) {
  const { diagram } = getAppState();
  const ids = new Set(boxes.map((box) => box.id));
  const outermost = boxes.filter((box) => {
    const object = diagram.objects.find((candidate) => candidate.id === box.id);
    return object && !ancestorsOf(diagram, object).some((ancestor) => ids.has(ancestor.id));
  });
  if (outermost.length === 0) return;
  const parents = new Set(outermost.map((box) => diagram.objects.find((object) => object.id === box.id)?.parent));
  const [parent] = parents.size === 1 ? [...parents] : [undefined];
  const left = Math.min(...outermost.map((box) => box.x)) - BOUNDARY_MARGIN;
  const top = Math.min(...outermost.map((box) => box.y)) - BOUNDARY_HEADER;
  const right = Math.max(...outermost.map((box) => box.x + box.width)) + BOUNDARY_MARGIN;
  const bottom = Math.max(...outermost.map((box) => box.y + box.height)) + BOUNDARY_MARGIN;
  const boundary: DiagramObject = {
    type: "boundary",
    id: crypto.randomUUID(),
    position: { x: left, y: top },
    size: { width: right - left, height: bottom - top },
    name: "",
    ...(kind ? { kind } : {}),
    ...(parent ? { parent } : {}),
  };
  const operations: DiagramOperation[] = [
    { type: "object.add", object: boundary },
    ...outermost.map(({ id }): DiagramOperation => ({ type: "object.update", id, changes: { parent: boundary.id } })),
  ];
  if (change("Group into boundary", operations)) select([boundary.id]);
}

export function groupSelected(kind?: BoundaryKind) {
  const boxes = selectedObjects(getAppState()).map((object) => ({
    id: object.id,
    ...object.position,
    ...estimatedSize[object.type],
    ...("size" in object && object.size),
  }));
  groupObjects(boxes, kind);
}

const OUTSIDE_GAP = 40;

export function moveOutOfBoundary(id: string) {
  const { diagram } = getAppState();
  const object = diagram.objects.find((candidate) => candidate.id === id);
  const boundary = diagram.objects.find((candidate) => candidate.id === object?.parent);
  if (!object || boundary?.type !== "boundary") return;
  const offset = { x: boundary.position.x + boundary.size.width + OUTSIDE_GAP - object.position.x, y: 0 };
  const parents = new Map<string, string | null>([[id, boundary.parent ?? null]]);
  change("Move out of boundary", moveOperations(withContents(diagram, new Map([[id, offset]])), parents));
}

export function setBoundaryKind(id: string, kind: BoundaryKind | undefined) {
  change("Change kind", [{ type: "object.update", id, changes: { kind: kind ?? null } }]);
}

function newConnection(from: string, to: string, fromSide?: Side, toSide?: Side): DiagramOperation {
  const connection: Connection = {
    id: crypto.randomUUID(),
    from,
    to,
    ...(fromSide && fromSide !== "right" && { fromSide }),
    ...(toSide && toSide !== "left" && { toSide }),
    label: "",
    direction: "forward",
    line: "solid",
  };
  return { type: "connection.add", connection };
}

export function canConnect(from: string, to: string): boolean {
  return validateOperation(getAppState().diagram, newConnection(from, to)).length === 0;
}

export function connect(from: string, to: string, fromSide?: Side, toSide?: Side) {
  change("Connect", [newConnection(from, to, fromSide, toSide)]);
}

export function setConnectionLabel(id: string, label: string) {
  change("Edit connection", [{ type: "connection.update", id, changes: { label } }], id);
}

export function setConnectionStyle(id: string, changes: Partial<Pick<Connection, "direction" | "line">>) {
  change("Edit connection", [{ type: "connection.update", id, changes }]);
}

export function remove(ids: string[], label = "Delete") {
  const { objects, connections } = getAppState().diagram;
  const doomed = <T extends { id: string }>(items: T[]) => items.filter((item) => ids.includes(item.id));
  // Connections go first: removing an object takes its remaining connections with it.
  change(label, [
    ...doomed(connections).map(({ id }): DiagramOperation => ({ type: "connection.remove", id })),
    ...doomed(objects).map(({ id }): DiagramOperation => ({ type: "object.remove", id })),
  ]);
}

export function removeSelected() {
  remove(getAppState().selection);
}
