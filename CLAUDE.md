# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ArchStudio** is an open-source desktop application for designing, understanding and reviewing software architecture with AI.

It is an architecture editor first: users design systems from components, connections and boundaries. AI works on the same semantic model to generate designs, propose changes and review them.

- AI runs on cloud models with the user's own API key. The UI must make clear when architecture data is sent to an external provider.
- Designs are plain, human-readable, git-friendly JSON files stored locally.
- No accounts, cloud sync or application backend. A hosted web build (archstudio.app, Cloudflare Pages, deployed from `main` by CI) runs the same app in a browser.

## Core architecture

Protect this design:

```
model -> tool call -> DiagramOperation[] -> validate -> semantic diff -> user accepts/rejects -> apply -> one undo step
```

The diagram belongs to ArchStudio, not React Flow and not the model. It is the plain data the canvas is drawn from, the file is saved from, and the AI reads and proposes changes to.

- Every meaningful change, manual or AI, goes through `DiagramOperation`s: `object.add/update/remove` and `connection.add/update/remove`. Boundaries use the same operations (`parent` is set with `object.update`); so do positions — there is no separate move operation.
- Agents never emit whole diagrams or React Flow state, only operations. Operations are validated before preview; invalid ones go back to the model as tool errors with a small retry limit.
- UI code never changes React Flow state to make an edit. Every edit goes through `change()` in `src/ui/state.ts` as one named undo step.
- Documents carry a `schemaVersion`. Schema v1 is frozen: any file-format change needs a new version and a migration.

### Domain vocabulary

`Diagram`, `DiagramObject`, `Component`, `Connection`, `Boundary`, `DiagramOperation`. Everything placed on a diagram is a `DiagramObject` (components, boundaries, shapes, text). "Diagram" was chosen over "architecture", "design" and "system design"; do not reintroduce those as names in code. `Node` and `Edge` are React Flow concepts and must not leak into the domain.

Components have a generic `kind`; the technology goes in the name or tags (a `database` named "Orders database" tagged "PostgreSQL"). Never make vendor products their own kinds. The bar for a kind's option is whether choosing differently would change the architecture. A missing option means "not specified": defaults are never filled in.

## Where things are

- `src/diagram/` — the domain: schema, component and boundary catalogues, operations, validation, apply, diff, parse/serialize, and `describe.ts` (the diagram and catalogue as text for a model).
- `src/agents/` — the assistant (`assistant.ts`) and the operations as a model writes them (`editOperations.ts`, derived from the domain schemas).
- `src/providers/` — Anthropic and OpenAI on the Vercel AI SDK, built from a `fetch` the caller passes in.
- `src/ui/` — React: `state.ts` (the Zustand store: diagram, selection, undo, proposal, file), `canvas/` (React Flow, Format with ELK, line routing), `inspector/` (Properties and Assistant), `landing/` (start dialog and templates), `files/`, `settings/`, and shared components in `components/`.
- `src/tauri/` — thin adapters to native functions, no-ops outside Tauri.
- `src-tauri/` — Rust, kept thin: saving files, the API keychain, the provider proxy and the updater.

Reuse `IconButton`, `Dialog`, `SegmentedControl`, `FloatingMenu`, `src/ui/icons.ts` and `src/ui/useKeyDown.ts` rather than re-implementing them.

## Decided

- The assistant lives in an inspector panel beside Properties, not a permanent chat column. One assistant answers questions, reviews and proposes changes: no modes, no separate Review tab, no starter prompts.
- Proposals are previewed on the canvas and decided per change or all at once; accepting is one undo step.
- Nodes have no popovers; everything is edited in the inspector or in place. Components cannot be resized; detail values go wider rather than wrap.
- Lines are right-angled and always meet a node at the middle of its side. Nodes are arranged only by the explicit Format, never automatically.
- A boundary has one parent; cross-cutting groupings go in tags. Removing a boundary keeps its contents.
- Templates are written without positions and arranged with Format when opened, because node sizes differ between webviews.
- The landing screen is a dialog, not a separate screen.
- Export is a PNG, drawn from the canvas with `html-to-image`, pinned to 1.11.11 because 1.11.13 drops connection lines. Shadows are off while exporting, as WebKit draws them as hard blocks. Check export in WebKit too: Chrome hid both problems. It is off during a proposal.
- Desktop releases are not code signed, as ArchStudio is free: macOS builds are ad-hoc signed, and the README gives the workarounds. Updates are still signed with the updater key.
- Orchestration is our own code on the AI SDK; LangGraph.js was dropped. Flows are short loops around a human in the app.

## Security

- **There is no Tauri command that returns an API key, and one must never be added.** Desktop keys live in the OS credential store; the webview reaches providers only through the Rust proxy (`provider_request`), which adds the key and only talks to the provider's own address.
- In a browser a key is kept only in the tab's `sessionStorage`, never a cookie or `localStorage`. The hosted site's Content Security Policy (`vite.config.ts`) is the real protection; the desktop app has its own in `tauri.conf.json`. Widen either deliberately.
- Only files the user picks in a dialog can be read or written. Never store architecture data in browser storage, or secrets in project files, logs or config.
- Desktop updates come only from GitHub Releases and must verify against the public key in `tauri.conf.json`. Its private key never goes in the repo.
- Release builds run every dependency, so they hold no secrets and restore no cache. Only the `sign` job has the signing key, and it runs nothing but the Tauri CLI. Pin every action to a commit SHA.
- A new Tauri command needs registering in the builder, naming in `build.rs` and granting in `capabilities/default.json`. A new provider needs an adapter, the Rust key and proxy lists, and the web CSP.
- Treat model output as untrusted. Surface model failures; never swallow them.

## Stack

Tauri v2 (Rust: `keyring`, `reqwest`), React 19, TypeScript (strict), Vite, React Flow (`@xyflow/react`), Zod, Zustand, elkjs, html-to-image, Tailwind CSS v4, `lucide-react`, Vercel AI SDK, Biome, Vitest with Testing Library. Bun is the package manager and script runner only; the app runs in the webview, so do not use Bun runtime APIs in app code.

## Commands

- `bun install`
- `bun run tauri dev` — the desktop app; `bun run dev` — the frontend alone at http://localhost:1420 (native calls fail)
- `bun run build`, `bun run typecheck`, `bun run lint`, `bun run format`
- `bun run test` — Vitest (`bun run test <path>` for one file). Do not use `bun test`.
- `cargo check` / `cargo clippy` / `cargo test` from `src-tauri/`

## Module boundaries

- `diagram` depends on nothing else in the app: plain TypeScript and Zod, no UI, React, Tauri, agents or providers.
- `agents` may use `diagram` and `providers`; `providers` uses neither UI nor Tauri. `biome.json` enforces these.
- `ui` may use everything above. Future `evals/` must run without React or Tauri.
- One package; no monorepo or extra tsconfig projects without a concrete reason.
- Tests live in a `__tests__/` folder beside the code, named `<Name>.test.ts(x)`.

## TypeScript

- Zod schemas are the source of truth; derive types with `z.infer`. Agent tool schemas derive from the domain schemas, never copies.
- Avoid `any`. Presentation maps over kinds are exhaustive (`Record<ComponentKind, …>`), so a new kind is a type error until it has one.

## Testing and evals

Every component, hook and domain function has unit tests; add or update them with any change. Evals (planned, under `evals/`) assert semantic outcomes — that a cache exists between the API and the database, that unrelated parts are unchanged — never prose, ids or coordinates. Evals may call paid models: never run the full suite unless asked.

## Milestone

1. [x] diagram schema and operations
2. [x] operation application and undo
3. [x] React Flow projection
4. [x] manual editing
5. [x] semantic diff and preview
6. [x] assistant with one cloud model
7. [ ] initial evals
8. [x] file persistence
9. [x] architecture reviewer (part of the assistant)
10. [ ] local models and additional providers
11. [ ] layout, export and polish
12. [ ] whiteboard import

## Out of scope

Unless asked: MCP, real-time collaboration, accounts, cloud sync, an application backend, freeform drawing, cost estimation.

## Working agreement

- Small, focused changes; no refactoring of unrelated code, and no abstractions for hypothetical needs. Prefer the existing stack; explain any new dependency first.
- Keep code plain and lightly commented: comment only what the code cannot say (a workaround, a non-obvious reason), in one line. No JSDoc restating names, no file headers.
- Prefer deterministic code wherever it can solve the problem.
- If a request conflicts with these rules, say so before implementing it.
- Run typecheck, lint and tests before finishing, and report anything that fails. Never claim something works without verifying it; for UI changes, check it in the app.
- Keep `README.md` in step with what is built.
