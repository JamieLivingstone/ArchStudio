import { applyOperations } from "../diagram/apply";
import { type DiagramChange, diffDiagrams } from "../diagram/diff";
import {
  type DiagramOperation,
  placementOperations,
  subjectOf,
  withDependents,
  withPrerequisites,
} from "../diagram/operations";
import type { Diagram, DiagramObject, Position, Size } from "../diagram/schema";
import { validateOperations } from "../diagram/validate";

type Outcome = "accepted" | "rejected";
// "stale": never decided, and no longer on offer because the diagram moved on or a newer proposal replaced it.
export type ChangeStatus = Outcome | "pending" | "stale";

export interface ProposalRow {
  change: DiagramChange;
  status: ChangeStatus;
  decidable: boolean;
}

export interface Proposal {
  id: string;
  base: Diagram;
  operations: DiagramOperation[];
  layout?: DiagramOperation[];
  arranged: boolean;
  changes: DiagramChange[];
  preview: Diagram;
  history: DiagramChange[];
  decided: Record<string, Outcome>;
}

export function buildProposal(
  diagram: Diagram,
  operations: DiagramOperation[],
  earlier?: Proposal,
  outcome?: Outcome,
): Proposal {
  let valid = [...operations, ...(earlier?.layout ?? [])];
  for (
    let issues = validateOperations(diagram, valid);
    issues.length > 0;
    issues = validateOperations(diagram, valid)
  ) {
    const faulty = new Set(issues.map((issue) => issue.operation));
    const kept = valid.filter((_, index) => !faulty.has(index));
    valid = kept.length < valid.length ? kept : [];
  }
  const own = valid.filter((operation) => operations.includes(operation));
  const after = applyOperations(diagram, valid);
  const changes = diffDiagrams(diagram, after);
  const subjects = new Set(own.map(subjectOf));
  const listed = changes.filter(({ id, change }) => change !== "moved" || subjects.has(id));
  const pending = new Map(listed.map((change) => [change.id, change]));
  const history = earlier?.history ?? [];
  // No prototype: an id may be any text, "__proto__" included.
  const decided: Record<string, Outcome> = Object.assign(Object.create(null), earlier?.decided);
  for (const { id } of earlier?.changes ?? []) {
    if (outcome && !pending.has(id) && history.some((change) => change.id === id)) decided[id] = outcome;
  }
  for (const id of pending.keys()) delete decided[id];
  const gone = <T extends { id: string }>(was: T[], now: T[]) =>
    was.filter((item) => !now.some((other) => other.id === item.id));
  return {
    id: earlier?.id ?? crypto.randomUUID(),
    base: diagram,
    operations: listed.length > 0 ? own : [],
    layout: earlier?.layout && valid.filter((operation) => !operations.includes(operation)),
    arranged: earlier?.arranged ?? false,
    changes,
    preview: {
      ...after,
      objects: [...after.objects, ...gone(diagram.objects, after.objects)],
      connections: [...after.connections, ...gone(diagram.connections, after.connections)],
    },
    history: [
      ...history.map((change) => pending.get(change.id) ?? change),
      ...listed.filter(({ id }) => !history.some((change) => change.id === id)),
    ],
    decided,
  };
}

function reroutes(operations: DiagramOperation[], from: string, to: string): boolean {
  const added = new Set(operations.flatMap((each) => (each.type === "object.add" ? [each.object.id] : [])));
  const reached = new Set([from]);
  for (let size = 0; size !== reached.size; ) {
    size = reached.size;
    for (const each of operations) {
      if (each.type !== "connection.add" || !reached.has(each.connection.from)) continue;
      if (each.connection.to === to && each.connection.from !== from) return true;
      if (added.has(each.connection.to)) reached.add(each.connection.to);
    }
  }
  return false;
}

export function withRejected(proposal: Proposal, ids?: string[]): Proposal {
  const [, kept] = ids ? withDependents(proposal.operations, ids) : [proposal.operations, []];
  const routeRejected = (id: string) => {
    const old = proposal.base.connections.find((connection) => connection.id === id);
    return old !== undefined && reroutes(proposal.operations, old.from, old.to) && !reroutes(kept, old.from, old.to);
  };
  const rest = kept.filter((operation) => !(operation.type === "connection.remove" && routeRejected(operation.id)));
  return { ...buildProposal(proposal.base, rest, proposal, "rejected"), arranged: false };
}

export function withReplaced({ base, operations }: Proposal, ids: string[]) {
  const [chosen] = withPrerequisites(operations, ids);
  const replaced = chosen.flatMap((operation) => {
    if (operation.type !== "connection.add") return [];
    const { from, to } = operation.connection;
    return base.connections.filter((old) => old.from === from && old.to === to).map((old) => old.id);
  });
  const taken = (operation: DiagramOperation) =>
    chosen.includes(operation) || (operation.type === "connection.remove" && replaced.includes(operation.id));
  return [operations.filter(taken), operations.filter((operation) => !taken(operation))];
}

export function withLayout(proposal: Proposal, positions: Map<string, Position>, sizes: Map<string, Size>): Proposal {
  const added = new Set<string>();
  const placed = proposal.operations.map((operation): DiagramOperation => {
    if (operation.type !== "object.add") return operation;
    const { object } = operation;
    added.add(object.id);
    const size = object.type === "boundary" ? sizes.get(object.id) : undefined;
    return {
      type: "object.add",
      object: {
        ...object,
        position: positions.get(object.id) ?? object.position,
        ...(size && { size }),
      } as DiagramObject,
    };
  });
  const existing = applyOperations(proposal.base, proposal.operations).objects.filter(({ id }) => !added.has(id));
  const layout = placementOperations(existing, positions, sizes);
  return { ...buildProposal(proposal.base, placed, { ...proposal, layout }), arranged: true };
}

export function proposalRows({ history, changes, decided, operations }: Proposal): ProposalRow[] {
  return history.map((change) => ({
    change,
    status: Object.keys(decided).includes(change.id)
      ? decided[change.id]
      : changes.some(({ id }) => id === change.id)
        ? "pending"
        : "stale",
    decidable: operations.some((operation) => subjectOf(operation) === change.id),
  }));
}
