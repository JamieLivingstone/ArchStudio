import { Check, ChevronRight, type LucideIcon, Minus, Move, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import type { DiagramChange } from "../../diagram/diff";
import { type ChangeStatus, type Proposal, type ProposalRow, proposalRows } from "../proposal";
import { acceptProposal, focusOn, rejectProposal, useAppState } from "../state";

const kinds: Record<DiagramChange["change"], { heading: string; icon: LucideIcon; tone: string }> = {
  added: { heading: "Added", icon: Plus, tone: "bg-emerald-600/15 text-emerald-600" },
  changed: { heading: "Changed", icon: Pencil, tone: "bg-accent/15 text-accent" },
  moved: { heading: "Moved", icon: Move, tone: "bg-muted/15 text-muted" },
  removed: { heading: "Removed", icon: Minus, tone: "bg-red-500/15 text-red-500" },
};
const order = Object.keys(kinds) as DiagramChange["change"][];

const outcomes = { accepted: "Accepted", rejected: "Rejected", stale: "Out of date" };

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const decide = "rounded-md border border-line bg-surface px-2 py-0.5 font-medium transition-colors";
const decideAll =
  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors";

function Row({ row }: { row: ProposalRow }) {
  const { change, status, decidable } = row;
  const focused = useAppState((state) => state.focus === change.id);
  const { id, title, what, fields } = change;
  const { icon: Icon, tone } = kinds[change.change];
  const having = change.change === "added" ? fields.map(({ label, after }) => `${label}: ${after}`) : [];

  return (
    <li
      ref={focused ? (element) => element?.scrollIntoView({ block: "nearest" }) : undefined}
      onMouseEnter={() => focusOn(id)}
      onMouseLeave={() => focusOn(undefined)}
      className={`group/row relative flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${focused ? "bg-hover" : ""}`}
    >
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ${tone}`}>
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <div className={`min-w-0 flex-1 ${status === "pending" ? "" : "opacity-55"}`}>
        <p className="text-[13px] font-medium wrap-anywhere text-fg">{title}</p>
        <p className="wrap-anywhere text-muted">{[capitalised(what), ...having].join(" · ")}</p>
        {change.change === "changed" &&
          fields.map(({ label, before, after }) => (
            <p key={label} className="mt-0.5 whitespace-pre-wrap wrap-anywhere text-muted">
              {label}: {before !== undefined && <del>{before}</del>}
              {before !== undefined && after !== undefined && " → "}
              {after !== undefined && <ins className="text-fg no-underline">{after}</ins>}
            </p>
          ))}
      </div>
      {status !== "pending" ? (
        <span className={`shrink-0 pt-0.5 ${status === "accepted" ? "text-emerald-600" : "text-muted"}`}>
          {outcomes[status]}
        </span>
      ) : (
        decidable && (
          <span className="absolute top-1 right-1.5 flex gap-1 bg-hover shadow-[-10px_0_8px_var(--hover)] opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              aria-label={`Reject ${title}`}
              onClick={() => rejectProposal([id])}
              className={`${decide} text-fg hover:border-red-500 hover:text-red-500`}
            >
              Reject
            </button>
            <button
              type="button"
              aria-label={`Accept ${title}`}
              onClick={() => acceptProposal([id])}
              className={`${decide} text-fg hover:border-emerald-600 hover:bg-emerald-600 hover:text-white`}
            >
              Accept
            </button>
          </span>
        )
      )}
    </li>
  );
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const current = useAppState((state) => state.proposal);
  const [last, setLast] = useState(proposal);
  const live = current?.id === proposal.id;
  if (live && current !== last) setLast(current);
  const rows = proposalRows(last).map(
    (row): ProposalRow => (!live && row.status === "pending" ? { ...row, status: "stale" } : row),
  );

  const moves = live ? (last.layout?.length ?? 0) : 0;
  const count = (status: ChangeStatus) => rows.filter((row) => row.status === status).length;
  const pending = count("pending");
  const rest = pending < rows.length ? "the rest" : "all";
  const summary = [
    pending > 0 ? `${pending} to decide` : undefined,
    ...(["accepted", "rejected", "stale"] as const).map((status) =>
      count(status) > 0 ? `${count(status)} ${outcomes[status].toLowerCase()}` : undefined,
    ),
  ]
    .filter(Boolean)
    .join(" · ");

  const sections = order.flatMap((kind) => {
    const inKind = rows.filter((row) => row.change.change === kind);
    if (inKind.length === 0) return [];
    return [
      <section key={kind} aria-label={kinds[kind].heading}>
        <h4 className="px-2 pt-2 pb-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
          {kinds[kind].heading}
        </h4>
        <ul>
          {inKind.map((row) => (
            <Row key={row.change.id} row={row} />
          ))}
        </ul>
      </section>,
    ];
  });

  if (pending === 0) {
    return (
      <section aria-label="Proposed change" className="shrink-0 rounded-xl border border-line text-xs">
        <details className="group/card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
            <ChevronRight size={14} className="shrink-0 text-muted transition-transform group-open/card:rotate-90" />
            <span className="text-sm font-medium">Proposed change</span>
            <span className="text-muted">{summary}</span>
          </summary>
          <div className="border-t border-line p-1 pt-0">{sections}</div>
        </details>
      </section>
    );
  }

  return (
    <section aria-label="Proposed change" className="shrink-0 rounded-xl border border-line text-xs">
      <header className="flex items-baseline gap-2 border-b border-line px-3 py-2">
        <h3 className="text-sm font-medium">Proposed change</h3>
        <p className="text-muted">{summary}</p>
      </header>
      <div className="p-1 pt-0">{sections}</div>
      {moves > 0 && (
        <p className="border-t border-line px-3 py-2 text-muted">
          {moves === 1 ? "1 thing moves" : `${moves} things move`} to make room.
        </p>
      )}
      <footer className="flex gap-2 border-t border-line p-2">
        <button
          type="button"
          onClick={() => rejectProposal()}
          className={`${decideAll} border border-line text-fg hover:border-red-500 hover:text-red-500`}
        >
          <X size={15} />
          Reject {rest}
        </button>
        <button
          type="button"
          onClick={() => acceptProposal()}
          className={`${decideAll} bg-accent text-surface hover:opacity-90`}
        >
          <Check size={15} />
          Accept {rest}
        </button>
      </footer>
    </section>
  );
}
