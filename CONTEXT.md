# Marrow Symphony

A desktop app for running interactive coding-agent CLIs against your work. You organize
work as Projects and Issues, give each Issue an isolated Workspace, and drive a coding agent
inside an embedded terminal Session — navigated through three first-class views: a Kanban **Board**,
a live-Session **Cockpit**, and a signature attention **Feed**. Named for its ancestor, the
"Symphony" orchestration spec (see `SPEC.md` and `docs/adr/0001-*`), from which it deliberately
diverges.

## Language

### Hierarchy

**Group**:
An optional, user-defined band that organizes Projects in the sidebar (e.g. "Work", "Client X").
A Project belongs to at most one Group. Purely organizational — it has no filesystem meaning.
_Avoid_: Folder, Space, Team
_(canonical name provisional — see open questions)_

**Project**:
A folder on disk surfaced in the app as a unit of work you manage; owns a set of Issues and may
optionally be linked to an external tracker (Linear). A Project may or may not be a git repo:
git-backed Projects support every Workspace Strategy (plus branches, PRs, and Linear-branch
features), while non-git Projects run in degraded mode — limited to the Shared checkout strategy.
_Avoid_: Folder, Repo (as the app-level concept)

**Issue**:
A single unit of work within a Project. Has a state (the column it sits in on the board) and can
own one or more Workspaces/Sessions. The unit a coding agent is pointed at.
_Avoid_: Ticket, Task, Card (a Card is the board's *rendering* of an Issue, not the Issue itself)

### Workflow

**State Type**:
The *role* of a board column, independent of its display label: `backlog`, `todo`, `started`,
`in-review`, `done`, or `canceled`. Columns are customizable per Project, but lifecycle automation
keys off the State Type — entering a `started` state preps the Workspace and launches the Runner;
`done`/`canceled` offers cleanup — so it works regardless of what a column is named (including Linear's
custom states, which carry equivalent types).
_Avoid_: Column type, Status kind

### Execution

**Workspace**:
The working directory + branch context in which one Issue's Sessions run, determined by that Issue's
Workspace Strategy — either a dedicated git worktree or the Project's shared checkout. Reused across
Sessions for the same Issue.
_Avoid_: Checkout, Sandbox

**Workspace Strategy**:
The per-Issue policy (defaulting from the Project) for how an Issue's Sessions sit against the
Project folder:
- **Shared checkout** — Sessions run directly in the Project's own directory. For git-backed Projects
  this is on a branch that may be shared across Issues (several Issues can run in parallel as long as
  they touch different files); for non-git Projects it is simply the folder. The only option when the
  Project is not a git repo.
- **Worktree** *(git-backed only)* — a dedicated git worktree + branch for the Issue; isolated;
  typically PR'd back.
- **Branch-in-place** *(git-backed only)* — a dedicated branch for the Issue, checked out in the
  Project's own directory (no separate dir); only one such Issue is active at a time.
_Avoid_: Isolation mode, Shared branch (use "Shared checkout")

**Session**:
A live, interactive terminal running a Runner inside an Issue's Workspace. The human drives the
agent here; the app owns the Session's lifecycle (spawn / resize / kill / scrollback).
_Avoid_: Run, Terminal (the terminal is the UI surface that *shows* a Session)

**Session Status**:
The runtime state of a Session, used to drive attention UI (badges, notifications, the Feed queue):
- **Running** — the agent is actively producing output; no human needed.
- **Needs Input** — the agent appears to be blocked waiting on the human. The trigger for a desktop
  notification and for entry into the Feed. Because Marrow is Runner-agnostic and does not speak the
  agent's protocol, this is *inferred* from terminal-level signals the Runner emits — the terminal bell
  / OSC notification sequences, or an explicit `marrow notify` hint from the Runner's hooks — and is
  best-effort; the human can always set it manually.
- **Idle** — alive but quiet, with no detected prompt; ambiguous (distinct from Needs Input only by
  heuristic).
- **Exited** — the Runner process ended (clean or crashed).
_Avoid_: Needs Attention (use "Needs Input" for the human-blocked state)

**Runner**:
A configurable profile for launching a coding-agent CLI in a Session — e.g. the interactive `claude`
TUI, `codex`, or `kilo`. Holds a launch command, a resume command (for session resume), and its own
env injection, and runs cwd'd to the Workspace; commands interpolate variables like
`{{workspace}}`, `{{issueFile}}`, `{{branch}}`, `{{resumeToken}}`. Separately, Marrow injects a fixed
layer of **system context** the Runner cannot edit or shadow (the materialized Issue file via
`MARROW_ISSUE_FILE`, plus identifiers used for attention signalling); the Runner's own env layers
beneath it. Ships as editable presets plus user-defined custom
Runners. A Project sets a default Runner; an Issue can override it. Marrow is Runner-agnostic — it
spawns the configured command and does not speak any one agent's protocol.
_Avoid_: Agent (the AI doing the work), Tool, Model

**Context bridge** (the `marrow` sidecar):
The Marrow-owned channel through which a Session's agent **reads** its Issue's context and **writes**
context back — without ever holding credentials. Implemented as the `marrow` sidecar: a small CLI the
Runner can call (`notify`, `issue read`, `issue comment`, `diff`) that talks to the app over a per-app
socket; Marrow resolves Session → Issue → Project and serves the request **locally** (the Issue in
SQLite + the materialized file) or, when the Project is linked, **proxies it to Linear**. This is the
seam that lets you write a prompt in Linear, hand it to *any* agent, and have the agent write progress
back. See `docs/adr/0009-*` (and `0008-*` for the shared socket).
_Avoid_: Plugin, Agent API (the agent *calls* it; it is not the agent or its protocol)

## Example dialogue

> **Dev:** When I drop MAR-7 into "In Progress", does it reuse the repo folder?
> **Domain expert:** No — the Project is the repo folder. MAR-7 gets its own Workspace, a git
> worktree of that repo, so it's isolated from whatever you're doing in the Project directly.
> **Dev:** And the terminal that opens in that Workspace?
> **Domain expert:** That's a Session. It runs whatever Runner you picked for MAR-7 — `claude`,
> `codex`, whatever. If you open a second terminal on the same Issue, that's a second Session in
> the same Workspace.
> **Dev:** Could two Projects sit under one folder?
> **Domain expert:** No. One folder, one repo, one Project. If you want them visually together,
> put both Projects in the same Group.
