---
status: done
slice: tracer-bullet
created: 2026-05-22
completed: 2026-06-02
---

# 0001 — Scaffold + first vertical slice

## Goal

Stand up the Marrow Symphony app from an empty repo and prove the **full thin spine** end-to-end:

> Add a Project (an existing git repo) → create an Issue → click **Start** → the backend preps a
> Workspace (shared-checkout strategy), writes the Issue into `.marrow/issues/<id>.md`, and spawns the
> default Runner in an **embedded terminal** cwd'd to the repo, where the agent can read its task.

This is a tracer bullet: it touches every layer (SQLite via sqlx → Tauri IPC → React → portable-pty
→ xterm.js → workspace + materialized context) so the riskiest integrations are proven before we
build breadth. See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md), [`CONTEXT.md`](../../../CONTEXT.md),
and ADRs [0002](../../adr/0002-runner-agnostic-interactive-terminals.md) /
[0003](../../adr/0003-local-first-sqlite-with-materialized-context.md).

## Definition of done

A user can, in a freshly built app: add a Project pointing at a real git repo, create one Issue,
press Start, and get a live terminal running the default Runner inside that repo, with
`.marrow/issues/<id>.md` present and `MARROW_ISSUE_FILE` set so the agent can read its task. Data
survives an app restart. The app boots cleanly via `pnpm tauri dev`.

## Decision log (stack choices for this slice)

| Area | Choice | Why |
|------|--------|-----|
| Bundler / lang | Vite + TypeScript (strict) | Tauri's default React template; strictness is a guardrail for agent-written code |
| Backend data | **sqlx** (SQLite), migrations, compile-time-checked queries | Backend owns all data access behind commands; no guessed shapes |
| Frontend server state | **TanStack Query** over Tauri `invoke`, invalidated by Tauri events | SQLite data behaves like server state |
| Frontend UI state | **Zustand** | Selected Issue, layout, terminal focus — without Redux ceremony |
| Styling / components | **Tailwind + shadcn/ui** | Components copied into the repo → agent can read/reshape them |
| Terminal | **portable-pty** (Rust) + **xterm.js** (React), bytes over Tauri events | ADR 0002 |
| Workspace Strategy (this slice) | **shared checkout** only | Simplest; no worktree management yet |
| Default Runner (this slice) | single hardcoded preset (`claude`) | Runner registry/editing deferred |

## Steps (each keeps the app working and is independently mergeable)

### Step 0 — Scaffold
- `pnpm create tauri-app` → React + TS + Vite; pin React 19 and Tauri 2.
- Init Tailwind + shadcn/ui. Add deps: sqlx (sqlite, runtime-tokio), TanStack Query, Zustand,
  @xterm/xterm, portable-pty.
- Prove IPC: a trivial `ping` Tauri command invoked from React via TanStack Query.
- **DoD:** `pnpm tauri dev` boots; the page shows a value returned from Rust.

### Step 1 — Store (sqlx + migrations)
- Migration: `projects`, `issues`, `board_columns` (with `state_type`), `sessions`. (`groups` schema
  may be included but no UI this slice.)
- Repo module + Tauri commands: `create_project`, `list_projects`, `create_issue`, `list_issues`.
- **DoD:** create/list Projects and Issues from a dev UI; data persists across restart.

### Step 2 — Cockpit shell + sidebar
- Sidebar: Projects ▸ Issues. "Add Project" (Tauri folder dialog; any folder allowed — detect and
  record whether it is git-backed, which gates git-only strategies later, but don't require git).
  "Add Issue" form.
- Empty session-cockpit surface (one of the three first-class views; see `docs/design-docs/ui-io-spec.md`).
- **DoD:** point a Project at a real repo, add an Issue, see them in the sidebar/cockpit.

### Step 3 — Workspace prep + materialized context
- On Start: resolve Workspace = Project repo dir (shared checkout); write
  `.marrow/issues/<id>.md`; ensure `.marrow/` is in git exclude; record a `sessions` row; set
  `MARROW_ISSUE_FILE`.
- **DoD:** Start writes the context file and creates a Session row.

### Step 4 — Embedded terminal (the risky bit)
- Rust: spawn PTY running the default Runner, cwd = Workspace, env includes `MARROW_ISSUE_FILE`;
  stream output via Tauri events; accept input + resize commands.
- React: xterm.js component bound to a Session; render in cockpit; forward keystrokes/resize.
- **DoD:** Start opens a live terminal in the repo running the agent; typing works; the agent can
  open `.marrow/issues/<id>.md`.

### Step 5 — Lifecycle + verification
- Kill PTY on Session/window close; reflect basic Session state in the cockpit.
- Manual verification checklist; a minimal smoke check that the app boots and `ping` returns.
- **DoD:** the full demo flow works end to end.

## Explicitly deferred (NOT in this slice)
Worktree & branch-in-place strategies · Kanban board · Linear sync · Runner presets/custom editing &
resume tokens · Groups UI · concurrency limits · multiple Sessions per Issue.

## Open questions touching this slice
- **Default Runner command** — hardcode `claude` for now; generalize in the Runner-registry slice.
- **Non-git Projects** — *resolved*: allowed in degraded mode (Shared checkout only). Slice 1 runs the
  Runner in the chosen folder regardless of git; git-backed features (worktree/branch/PR) are deferred
  to a later slice.

## Verification & legibility (agent-first)
Per the harness doc, the app should be drivable by an agent. This slice keeps it minimal, but: prefer
a `pnpm tauri dev` that boots fast, keep the `ping`/smoke check green, and structure the terminal so
its scrollback is inspectable. Richer agent-driving (screenshots/DOM, per-worktree boot) is a later
investment, tracked when worktrees land.

## Progress log
- 2026-05-22 — Plan created; stack decisions settled via grilling. No steps started yet.
- 2026-06-02 — Implemented and merged (scaffold, SQLite store, PTY-backed terminal Sessions). DoD met;
  the full thin spine boots via `pnpm tauri dev`. Slice closed. Next: [`0002`](./0002-full-functional-ui.md).
