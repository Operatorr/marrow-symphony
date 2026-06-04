# Architecture

Top-level map of Marrow Symphony. For domain vocabulary see [`CONTEXT.md`](./CONTEXT.md); for the
*why* behind these shapes see [`docs/adr/`](./docs/adr/). This describes the intended design; it is a
plan, not yet a description of shipped code.

## Shape

A single desktop app: a **React 19** frontend and a **Rust** backend, bridged by **Tauri 2** IPC
(commands frontend→backend, events backend→frontend). One SQLite database is the source of truth.
There is **no separate daemon** — the GUI process owns everything, including the agent PTYs (see
[ADR 0003] and the session-durability decision: durability comes from Runner *resume*, not a
background process).

The frontend exposes **three first-class views** (not one primary view). See
[`docs/design-docs/ui-io-spec.md`](./docs/design-docs/ui-io-spec.md) for the full surface spec and
[ADR 0006] for the rationale.

```
┌─────────────────────────── React 19 (frontend) ───────────────────────────┐
│  Sidebar: flat Project list + Group filter; collapsible (Cmd+B)            │
│  Three first-class views (top-bar switch):                                 │
│    - Board    Issues by State Type; scope: This Project | All (global)     │
│    - Sessions fleet of live Sessions, grouped by Project, attention-lit    │
│    - Feed     SIGNATURE: one Needs-Input Session at a time, advance to next│
│  Issue page (card -> detail), embedded terminals (xterm.js), Runner/forms  │
└───────────────────────────────── Tauri IPC ────────────────────────────────┘
┌─────────────────────────────── Rust (backend) ─────────────────────────────┐
│  Store         SQLite: Groups, Projects, Issues, board state, sync metadata │
│  Workspaces    worktree | shared-branch | branch-in-place; context material.│
│  Sessions      portable-pty: spawn/resize/kill, scrollback, resume tokens   │
│  Runners       editable presets + custom; launch/resume command templates   │
│  Lifecycle     state-type-driven automation (started→prep+launch, done→clean)│
│  Attention     best-effort Session status (Running/Needs Input/Idle/Exited) │
│  Linear sync   optional, per-Project, two-way (phased); maps to State Types  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Backend domains

- **Store.** SQLite in the app data dir. Holds the hierarchy (Group → Project → Issue), board
  columns + their State Types, Session metadata (incl. scrollback refs and resume tokens), and
  Linear sync state. Source of truth. ([ADR 0003])
- **Workspaces.** Prepares an Issue's working directory per its **Workspace Strategy** (dedicated
  worktree, or the Project's shared checkout) and materializes the Issue into
  `.marrow/issues/<id>.md` (git-excluded), exposed to the Runner via `MARROW_ISSUE_FILE`.
- **Sessions.** Owns PTYs via the `portable-pty` crate. Spawns the chosen Runner cwd'd to the
  Workspace, streams I/O to xterm.js, tracks lifecycle, and persists scrollback + the Runner's
  resume token so a relaunch can resume. ([ADR 0002])
- **Runners.** A registry of Runner profiles (claude / codex / kilo presets + user-defined), each
  with launch + resume command templates and env injection. A Project sets a default; an Issue can
  override.
- **Lifecycle automation.** Reacts to Issue state transitions by **State Type**: entering `started`
  preps the Workspace and launches the Runner; `done`/`canceled` offers worktree cleanup. Never
  keys off a column's display label.
- **Attention.** Derives each Session's status (Running / Needs Input / Idle / Exited) from terminal
  signals — best-effort, since Marrow does not speak the agent's protocol — and emits the
  Needs-Input transitions that drive desktop notifications and the Feed. Always overridable by hand.
  ([ADR 0006])
- **Linear sync.** Per-Project, opt-in, local-first. Phase 1: import Linear issues + push state
  changes. Later: fuller two-way sync. Maps Linear's typed workflow states onto Marrow State Types.

### Data-model notes (from UI decisions)

These fields emerged from the UI/IO spec and belong in the Store schema (none are slice-1-critical):

- **Project** — `color` (per-Project identity used across Sessions tiles, terminal frame, sidebar),
  `git_backed` flag (gates git-only Workspace Strategies), default Runner, Group ref, Linear link.
- **Session** — `status` enum (Running / Needs Input / Idle / Exited), `needs_input_since` timestamp
  (powers the Feed's oldest-waiting ordering), `muted` / manual-override flags, scrollback ref,
  resume token.
- **Runner preset** — `needs_input_patterns` (regexes) plus opt-in OSC / `marrow notify` signalling
  for best-effort attention detection (see [`docs/design-docs/ui-io-spec.md`](./docs/design-docs/ui-io-spec.md) §8).

## What we borrowed vs. dropped from Symphony (`SPEC.md`)

- **Borrowed:** workspace model (§9), normalized Issue + tracker model (§4, §11), observability
  ideas (§13).
- **Dropped:** the Codex app-server protocol (§10), the unattended poll/dispatch/retry/reconcile
  loop (§7, §8), the DB-less recovery model (§14.3), `WORKFLOW.md` as the policy contract (§5).

[ADR 0002]: ./docs/adr/0002-runner-agnostic-interactive-terminals.md
[ADR 0003]: ./docs/adr/0003-local-first-sqlite-with-materialized-context.md
[ADR 0006]: ./docs/adr/0006-three-view-ia-with-attention-feed.md
